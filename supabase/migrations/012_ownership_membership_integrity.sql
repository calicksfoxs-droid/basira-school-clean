-- PHASE 1.5: ownership + membership graph integrity.
-- Keep legacy Group -> Subject compatibility while making ownership and
-- membership invariants database-authoritative.
--
-- Guarantees:
-- - every group owner is an active teacher
-- - subject-linked group owner must equal root subject owner
-- - legacy group owner changes atomically re-home legacy subjects to the new
--   teacher and to that teacher's active "صف غير مصنف" fallback grade
-- - subject owner must be an active teacher and must match its grade owner
-- - root subject ownership cannot be partially changed while linked groups exist
-- - every membership target is a student; active membership requires active student

do $$
begin
  if exists (
    select 1
    from public.groups g
    left join public.profiles p on p.id=g.owner_teacher_id
    where p.id is null or p.role<>'teacher' or p.status<>'active'
  ) then
    raise exception 'Existing group owner integrity violation';
  end if;

  if exists (
    select 1
    from public.subjects s
    join public.curriculum_grades g on g.id=s.grade_id
    where s.owner_teacher_id is distinct from g.owner_teacher_id
  ) then
    raise exception 'Existing subject grade ownership violation';
  end if;

  if exists (
    select 1
    from public.subjects s
    join public.groups g on g.id=s.group_id
    where s.group_id is not null
      and s.owner_teacher_id is distinct from g.owner_teacher_id
  ) then
    raise exception 'Existing legacy subject ownership violation';
  end if;

  if exists (
    select 1
    from public.groups g
    join public.subjects s on s.id=g.subject_id
    where g.subject_id is not null
      and g.owner_teacher_id is distinct from s.owner_teacher_id
  ) then
    raise exception 'Existing subject-linked group ownership violation';
  end if;

  if exists (
    select 1
    from public.group_memberships m
    join public.profiles p on p.id=m.student_id
    where p.role<>'student'
       or (m.status='active' and p.status<>'active')
  ) then
    raise exception 'Existing membership target integrity violation';
  end if;
end
$$;

create or replace function public.enforce_subject_group_owner_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_status text;
  v_subject_owner uuid;
begin
  select p.role,p.status
  into v_role,v_status
  from public.profiles p
  where p.id=new.owner_teacher_id;

  if v_role is distinct from 'teacher'
     or v_status is distinct from 'active'
  then
    raise exception 'Group owner must be an active teacher';
  end if;

  if new.subject_id is not null then
    select s.owner_teacher_id
    into v_subject_owner
    from public.subjects s
    where s.id=new.subject_id
      and s.group_id is null;

    if v_subject_owner is null then
      raise exception 'Invalid learning subject';
    end if;

    if new.owner_teacher_id is distinct from v_subject_owner then
      raise exception 'Subject-linked group owner must match subject owner';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_learning_subject_owner_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_group_owner uuid;
  v_grade_owner uuid;
  v_role text;
  v_status text;
begin
  select p.role,p.status
  into v_role,v_status
  from public.profiles p
  where p.id=new.owner_teacher_id;

  if v_role is distinct from 'teacher'
     or v_status is distinct from 'active'
  then
    raise exception 'A subject requires an active teacher owner';
  end if;

  if new.group_id is not null then
    select g.owner_teacher_id
    into v_group_owner
    from public.groups g
    where g.id=new.group_id;

    if v_group_owner is null then
      raise exception 'Invalid legacy group';
    end if;

    if new.owner_teacher_id is distinct from v_group_owner then
      raise exception 'Legacy subject owner must match group owner';
    end if;
  elsif tg_op='UPDATE'
    and new.owner_teacher_id is distinct from old.owner_teacher_id
    and exists (
      select 1
      from public.groups g
      where g.subject_id=new.id
    )
  then
    raise exception 'Root subject ownership cannot change while linked groups exist';
  end if;

  select g.owner_teacher_id
  into v_grade_owner
  from public.curriculum_grades g
  where g.id=new.grade_id;

  if v_grade_owner is null
     or new.owner_teacher_id is distinct from v_grade_owner
  then
    raise exception 'Subject grade must belong to the subject owner';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_learning_subject_owner_v1 on public.subjects;

create trigger enforce_learning_subject_owner_v1
before insert or update of group_id,owner_teacher_id,grade_id
on public.subjects
for each row
execute function public.enforce_learning_subject_owner_v1();

create or replace function public.sync_legacy_group_subject_ownership_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_fallback_grade_id uuid;
  v_next_order integer;
begin
  if new.subject_id is not null
     or new.owner_teacher_id is not distinct from old.owner_teacher_id
     or not exists (
       select 1
       from public.subjects s
       where s.group_id=new.id
     )
  then
    return null;
  end if;

  -- Serialize fallback-grade creation for concurrent transfers to the same teacher.
  perform 1
  from public.profiles p
  where p.id=new.owner_teacher_id
  for update;

  select g.id
  into v_fallback_grade_id
  from public.curriculum_grades g
  where g.owner_teacher_id=new.owner_teacher_id
    and g.title='صف غير مصنف'
    and g.status='active'
  order by g.created_at,g.id
  limit 1;

  if v_fallback_grade_id is null then
    loop
      select coalesce(max(g.display_order),0)+1
      into v_next_order
      from public.curriculum_grades g
      where g.owner_teacher_id=new.owner_teacher_id;

      begin
        insert into public.curriculum_grades(
          owner_teacher_id,
          title,
          display_order,
          status
        )
        values(
          new.owner_teacher_id,
          'صف غير مصنف',
          v_next_order,
          'active'
        )
        returning id into v_fallback_grade_id;

        exit;
      exception
        when unique_violation then
          select g.id
          into v_fallback_grade_id
          from public.curriculum_grades g
          where g.owner_teacher_id=new.owner_teacher_id
            and g.title='صف غير مصنف'
            and g.status='active'
          order by g.created_at,g.id
          limit 1;

          if v_fallback_grade_id is not null then
            exit;
          end if;
      end;
    end loop;
  end if;

  update public.subjects s
  set owner_teacher_id=new.owner_teacher_id,
      grade_id=v_fallback_grade_id
  where s.group_id=new.id;

  return null;
end;
$$;

drop trigger if exists sync_legacy_group_subject_ownership_v1 on public.groups;

create trigger sync_legacy_group_subject_ownership_v1
after update of owner_teacher_id
on public.groups
for each row
execute function public.sync_legacy_group_subject_ownership_v1();

create or replace function public.enforce_group_membership_student_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_status text;
begin
  select p.role,p.status
  into v_role,v_status
  from public.profiles p
  where p.id=new.student_id;

  if v_role is distinct from 'student' then
    raise exception 'Membership target must be a student';
  end if;

  if new.status='active'
     and v_status is distinct from 'active'
  then
    raise exception 'Active membership requires an active student';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_group_membership_student_v1 on public.group_memberships;

create trigger enforce_group_membership_student_v1
before insert or update of student_id,status
on public.group_memberships
for each row
execute function public.enforce_group_membership_student_v1();

-- Trigger functions are internal-only and must not become client RPCs.
revoke all on function public.enforce_subject_group_owner_v1()
  from public,anon,authenticated;
revoke all on function public.enforce_learning_subject_owner_v1()
  from public,anon,authenticated;
revoke all on function public.sync_legacy_group_subject_ownership_v1()
  from public,anon,authenticated;
revoke all on function public.enforce_group_membership_student_v1()
  from public,anon,authenticated;
