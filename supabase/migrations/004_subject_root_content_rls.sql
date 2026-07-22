-- Basira V1 - bridge the original lesson/content model to teacher-owned
-- Learning Core subjects whose subjects.group_id is NULL.
--
-- The original policies authorize content through subjects.group_id. Learning
-- Core instead owns the subject directly and attaches one or more groups using
-- groups.subject_id. These helpers keep both models valid without widening
-- access across teachers or unenrolled students.

begin;

create or replace function public.teacher_owns_lesson_v2(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select public.current_app_role()='teacher' and exists(
    select 1
    from public.lessons l
    join public.subjects s on s.id=l.subject_id
    where l.id=p_lesson_id
      and s.owner_teacher_id=auth.uid()
  )
$$;

create or replace function public.student_can_access_subject_v2(p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select public.current_app_role()='student' and exists(
    select 1
    from public.subjects s
    where s.id=p_subject_id
      and (
        (
          s.group_id is not null
          and s.status='active'
          and exists(
            select 1
            from public.groups g
            join public.group_memberships m on m.group_id=g.id
            where g.id=s.group_id
              and g.status='active'
              and m.student_id=auth.uid()
              and m.status='active'
          )
        )
        or
        (
          s.group_id is null
          and s.status='published'
          and exists(
            select 1
            from public.groups g
            join public.group_memberships m on m.group_id=g.id
            where g.subject_id=s.id
              and g.status='active'
              and m.student_id=auth.uid()
              and m.status='active'
          )
        )
      )
  )
$$;

-- Preserve the public helper name introduced by migration 002, but make its
-- semantics exact: a root subject is visible only after publication and only
-- through an active group membership. Keeping the name updated also tightens
-- the already-installed subject/unit/lesson policies that call it.
create or replace function public.student_in_learning_subject_v1(p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select public.student_can_access_subject_v2(p_subject_id)
$$;

-- Replace the legacy helpers used transitively by lesson parts, assets,
-- quizzes, questions, submissions and grading RPCs.
create or replace function public.teacher_owns_quiz(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(
    select 1
    from public.quizzes q
    left join public.lesson_parts p on p.id=q.lesson_part_id
    where q.id=p_quiz_id
      and public.teacher_owns_lesson_v2(coalesce(q.lesson_id,p.lesson_id))
  )
$$;

create or replace function public.student_can_access_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(
    select 1
    from public.lessons l
    join public.subjects s on s.id=l.subject_id
    left join public.subject_units u on u.id=l.unit_id
    where l.id=p_lesson_id
      and l.status='published'
      and public.student_can_access_subject_v2(s.id)
      and (
        (s.group_id is not null and l.unit_id is null)
        or
        (s.group_id is null and l.unit_id is not null and u.status='published')
      )
  )
$$;

create or replace function public.student_can_access_quiz(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(
    select 1
    from public.quizzes q
    left join public.lesson_parts p on p.id=q.lesson_part_id
    where q.id=p_quiz_id
      and q.status='published'
      and public.student_can_access_lesson(coalesce(q.lesson_id,p.lesson_id))
  )
$$;

-- The migration-002 lesson policy did not require the parent unit itself to be
-- published. Replace it so a draft unit cannot leak a published child lesson.
drop policy if exists lessons_student_enrolled_v1 on public.lessons;
create policy lessons_student_enrolled_v1 on public.lessons for select
using (public.student_can_access_lesson(id));

-- Core-subject policies are additive. The legacy group-scoped policies remain
-- in place for rows created before the Learning Core migration.
create policy lesson_parts_teacher_owned_v2 on public.lesson_parts for all
using (public.teacher_owns_lesson_v2(lesson_id))
with check (public.teacher_owns_lesson_v2(lesson_id));

create policy lesson_parts_student_enrolled_v2 on public.lesson_parts for select
using (public.student_can_access_lesson(lesson_id));

create policy lesson_assets_teacher_owned_v2 on public.lesson_assets for all
using (
  kind <> 'submission'
  and public.teacher_owns_lesson_v2(
    coalesce(lesson_id,(select p.lesson_id from public.lesson_parts p where p.id=lesson_part_id))
  )
)
with check (
  kind <> 'submission'
  and public.teacher_owns_lesson_v2(
    coalesce(lesson_id,(select p.lesson_id from public.lesson_parts p where p.id=lesson_part_id))
  )
);

create policy quizzes_teacher_owned_v2 on public.quizzes for all
using (public.teacher_owns_quiz(id))
with check (
  public.teacher_owns_lesson_v2(
    coalesce(lesson_id,(select p.lesson_id from public.lesson_parts p where p.id=lesson_part_id))
  )
);

-- Use the real asset -> lesson relationship for downloads. The object path is
-- never treated as proof of student access.
create or replace function public.can_read_lesson_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(
    select 1
    from public.lesson_assets a
    left join public.lesson_parts p on p.id=a.lesson_part_id
    where a.storage_path=p_name
      and a.kind in ('video','handout')
      and a.state='ready'
      and public.student_can_access_lesson(coalesce(a.lesson_id,p.lesson_id))
  )
$$;

create or replace function public.teacher_can_manage_storage_scope_v2(p_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select public.owns_group(p_scope_id) or public.owns_learning_subject_v1(p_scope_id)
$$;

create or replace function public.student_can_access_storage_scope_v2(p_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select public.student_in_group(p_scope_id) or public.student_can_access_subject_v2(p_scope_id)
$$;

-- For new root subjects the first storage path segment is the subject id; for
-- legacy content it remains the group id.
create policy storage_teacher_lesson_manage_v2 on storage.objects for all to authenticated
using (
  bucket_id in ('lesson-videos','lesson-handouts')
  and public.teacher_can_manage_storage_scope_v2(public.safe_uuid(split_part(name,'/',1)))
)
with check (
  bucket_id in ('lesson-videos','lesson-handouts')
  and public.teacher_can_manage_storage_scope_v2(public.safe_uuid(split_part(name,'/',1)))
);

create policy storage_student_submission_insert_v2 on storage.objects for insert to authenticated
with check (
  bucket_id='submission-files'
  and public.current_app_role()='student'
  and public.safe_uuid(split_part(name,'/',3))=auth.uid()
  and public.student_can_access_storage_scope_v2(public.safe_uuid(split_part(name,'/',1)))
);

create policy storage_submission_select_v2 on storage.objects for select to authenticated
using (
  bucket_id='submission-files'
  and (
    (public.current_app_role()='student' and public.safe_uuid(split_part(name,'/',3))=auth.uid())
    or public.teacher_can_manage_storage_scope_v2(public.safe_uuid(split_part(name,'/',1)))
    or public.is_admin()
  )
);

-- Finalization used to reject root-subject lessons because group_for_lesson()
-- correctly returns NULL for them. Authorize against the subject owner and
-- bind the object path to the expected legacy-group/root-subject scope.
create or replace function public.finalize_lesson_asset_phase13a(
  p_kind text,
  p_lesson_id uuid,
  p_lesson_part_id uuid,
  p_title text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
returns public.lesson_assets
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_lesson_id uuid;
  v_subject_id uuid;
  v_group_id uuid;
  v_scope_id uuid;
  v_asset public.lesson_assets%rowtype;
begin
  if public.current_app_role() <> 'teacher' then raise exception 'Not allowed'; end if;
  if p_kind not in ('video','handout') then raise exception 'Invalid asset kind'; end if;
  if ((p_lesson_id is not null)::int + (p_lesson_part_id is not null)::int) <> 1 then
    raise exception 'Exactly one content parent is required';
  end if;

  if p_lesson_part_id is not null then
    select p.lesson_id into v_lesson_id
    from public.lesson_parts p
    where p.id=p_lesson_part_id;
  else
    v_lesson_id := p_lesson_id;
  end if;

  select s.id,s.group_id into v_subject_id,v_group_id
  from public.lessons l
  join public.subjects s on s.id=l.subject_id
  where l.id=v_lesson_id;

  if v_subject_id is null or not public.teacher_owns_lesson_v2(v_lesson_id) then
    raise exception 'Not allowed';
  end if;

  v_scope_id := coalesce(v_group_id,v_subject_id);
  if public.safe_uuid(split_part(p_storage_path,'/',1)) is distinct from v_scope_id then
    raise exception 'Invalid storage scope';
  end if;

  update public.lesson_assets
  set state='removed'
  where kind=p_kind and state <> 'removed'
    and (
      (p_lesson_id is not null and lesson_id=p_lesson_id)
      or (p_lesson_part_id is not null and lesson_part_id=p_lesson_part_id)
    );

  insert into public.lesson_assets(
    kind,lesson_id,lesson_part_id,title,storage_path,original_filename,mime_type,size_bytes,state
  )
  values(
    p_kind,p_lesson_id,p_lesson_part_id,left(p_title,120),p_storage_path,
    p_original_filename,p_mime_type,p_size_bytes,'ready'
  )
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint) from public,anon;
grant execute on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint) to authenticated;

commit;
