-- Core 1.0 repair invariants.
-- Additive only: this migration does not guess or rewrite ambiguous legacy relationships.

begin;

-- ---------------------------------------------------------------------------
-- 1) Repair diagnostics: service-role only, deterministic and cheap enough for
--    release gates. These are domain inconsistencies, not infrastructure health.
-- ---------------------------------------------------------------------------
create or replace function public.core1_repair_diagnostics_v1()
returns table(issue text, issue_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select 'active_group_without_subject_id', count(*)::bigint
  from public.groups g
  where g.status = 'active' and g.subject_id is null

  union all

  select 'active_membership_on_unlinked_group', count(*)::bigint
  from public.group_memberships m
  join public.groups g on g.id = m.group_id
  where m.status = 'active'
    and g.status = 'active'
    and g.subject_id is null

  union all

  select 'learning_subject_without_units', count(*)::bigint
  from public.subjects s
  where s.group_id is null
    and s.status <> 'archived'
    and not exists (
      select 1 from public.subject_units u
      where u.subject_id = s.id and u.status <> 'archived'
    )

  union all

  select 'published_subject_without_active_group', count(*)::bigint
  from public.subjects s
  where s.group_id is null
    and s.status = 'published'
    and not exists (
      select 1 from public.groups g
      where g.subject_id = s.id and g.status = 'active'
    )

  union all

  select 'published_subject_without_published_unit', count(*)::bigint
  from public.subjects s
  where s.group_id is null
    and s.status = 'published'
    and not exists (
      select 1 from public.subject_units u
      where u.subject_id = s.id and u.status = 'published'
    )

  union all

  select 'learning_lesson_without_unit', count(*)::bigint
  from public.lessons l
  join public.subjects s on s.id = l.subject_id
  where s.group_id is null
    and l.status <> 'archived'
    and l.unit_id is null

  union all

  select 'active_membership_for_inactive_student', count(*)::bigint
  from public.group_memberships m
  join public.profiles p on p.id = m.student_id
  where m.status = 'active'
    and (p.role <> 'student' or p.status <> 'active')

  union all

  select 'active_membership_in_inactive_group', count(*)::bigint
  from public.group_memberships m
  join public.groups g on g.id = m.group_id
  where m.status = 'active' and g.status <> 'active'

  union all

  select 'subject_grade_owner_mismatch', count(*)::bigint
  from public.subjects s
  join public.curriculum_grades g on g.id = s.grade_id
  where s.owner_teacher_id is distinct from g.owner_teacher_id

  union all

  select 'group_subject_owner_mismatch', count(*)::bigint
  from public.groups g
  join public.subjects s on s.id = g.subject_id
  where g.owner_teacher_id is distinct from s.owner_teacher_id;
$$;

revoke all on function public.core1_repair_diagnostics_v1() from public, anon, authenticated;
grant execute on function public.core1_repair_diagnostics_v1() to service_role;

-- ---------------------------------------------------------------------------
-- 2) Student subject projection.
--    SECURITY INVOKER is intentional: subjects RLS remains the primary privacy
--    boundary. The function never enumerates all platform subjects as service_role.
-- ---------------------------------------------------------------------------
create or replace function public.list_my_learning_subjects_v1()
returns table(
  id uuid,
  owner_teacher_id uuid,
  grade_id uuid,
  title text,
  description text,
  cover_key text,
  banner_title text,
  banner_body text,
  banner_cta_label text,
  banner_cta_path text,
  status text,
  display_order integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.owner_teacher_id,
    s.grade_id,
    s.title,
    s.description,
    s.cover_key,
    s.banner_title,
    s.banner_body,
    s.banner_cta_label,
    s.banner_cta_path,
    s.status,
    s.display_order,
    s.created_at,
    s.updated_at
  from public.subjects s
  join public.curriculum_grades g on g.id = s.grade_id
  where public.current_app_role() = 'student'
    and public.session_is_current()
    and g.status = 'active'
    and s.status in ('active', 'published')
  order by g.display_order, s.display_order, s.id;
$$;

revoke all on function public.list_my_learning_subjects_v1() from public, anon;
grant execute on function public.list_my_learning_subjects_v1() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Atomic authoring primitives.
--    Parent-row locks serialize order allocation and remove count/max races.
-- ---------------------------------------------------------------------------
create or replace function public.create_curriculum_grade_v2(
  p_title text,
  p_description text default null
)
returns public.curriculum_grades
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_order integer;
  v_grade public.curriculum_grades%rowtype;
begin
  if v_teacher is null
     or not public.session_is_current()
     or public.current_app_role() <> 'teacher' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  perform 1
  from public.profiles p
  where p.id = v_teacher and p.role = 'teacher' and p.status = 'active'
  for update;
  if not found then raise exception 'Not allowed' using errcode = '42501'; end if;

  select coalesce(max(g.display_order), 0) + 1
  into v_order
  from public.curriculum_grades g
  where g.owner_teacher_id = v_teacher;

  insert into public.curriculum_grades(owner_teacher_id, title, description, display_order, status)
  values (v_teacher, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), v_order, 'active')
  returning * into v_grade;

  return v_grade;
end;
$$;

revoke all on function public.create_curriculum_grade_v2(text,text) from public, anon;
grant execute on function public.create_curriculum_grade_v2(text,text) to authenticated;

-- Subject ordering is grade-local in the canonical Learning Core.
create unique index if not exists subjects_grade_display_order_v2_unique
  on public.subjects(grade_id, display_order)
  where group_id is null;

create or replace function public.create_learning_subject_v2(
  p_grade_id uuid,
  p_title text,
  p_description text default null,
  p_cover_key text default null
)
returns public.subjects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_grade public.curriculum_grades%rowtype;
  v_order integer;
  v_subject public.subjects%rowtype;
  v_term integer;
  v_unit integer;
begin
  if v_teacher is null
     or not public.session_is_current()
     or public.current_app_role() <> 'teacher' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_grade
  from public.curriculum_grades g
  where g.id = p_grade_id
  for update;

  if not found
     or v_grade.owner_teacher_id <> v_teacher
     or v_grade.status <> 'active' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(max(s.display_order), 0) + 1
  into v_order
  from public.subjects s
  where s.grade_id = p_grade_id and s.group_id is null;

  insert into public.subjects(
    group_id, grade_id, owner_teacher_id, title, description,
    cover_key, display_order, status
  )
  values (
    null, p_grade_id, v_teacher, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_cover_key, '')), ''),
    v_order, 'draft'
  )
  returning * into v_subject;

  for v_term in 1..4 loop
    for v_unit in 1..2 loop
      insert into public.subject_units(subject_id, term_segment, title, display_order, status)
      values (
        v_subject.id,
        v_term,
        case when v_unit = 1 then 'الوحدة الأولى' else 'الوحدة الثانية' end,
        v_unit,
        'draft'
      );
    end loop;
  end loop;

  return v_subject;
end;
$$;

revoke all on function public.create_learning_subject_v2(uuid,text,text,text) from public, anon;
grant execute on function public.create_learning_subject_v2(uuid,text,text,text) to authenticated;

create or replace function public.create_subject_unit_v2(
  p_subject_id uuid,
  p_term_segment integer,
  p_title text,
  p_description text default null
)
returns public.subject_units
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_subject public.subjects%rowtype;
  v_order integer;
  v_unit public.subject_units%rowtype;
begin
  if v_teacher is null
     or not public.session_is_current()
     or public.current_app_role() <> 'teacher' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_term_segment < 1 or p_term_segment > 4 then
    raise exception 'Invalid term segment';
  end if;

  select * into v_subject
  from public.subjects s
  where s.id = p_subject_id
  for update;

  if not found
     or v_subject.group_id is not null
     or v_subject.owner_teacher_id <> v_teacher
     or v_subject.status = 'archived' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(max(u.display_order), 0) + 1
  into v_order
  from public.subject_units u
  where u.subject_id = p_subject_id
    and u.term_segment = p_term_segment;

  insert into public.subject_units(subject_id, term_segment, title, description, display_order, status)
  values (
    p_subject_id, p_term_segment, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''), v_order, 'draft'
  )
  returning * into v_unit;

  return v_unit;
end;
$$;

revoke all on function public.create_subject_unit_v2(uuid,integer,text,text) from public, anon;
grant execute on function public.create_subject_unit_v2(uuid,integer,text,text) to authenticated;

create or replace function public.create_unit_lesson_v2(
  p_unit_id uuid,
  p_title text,
  p_description text default null,
  p_structure_mode text default 'direct'
)
returns public.lessons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_unit public.subject_units%rowtype;
  v_subject public.subjects%rowtype;
  v_order integer;
  v_lesson public.lessons%rowtype;
begin
  if v_teacher is null
     or not public.session_is_current()
     or public.current_app_role() <> 'teacher' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_structure_mode not in ('direct', 'parts') then
    raise exception 'Invalid lesson structure mode';
  end if;

  select * into v_unit
  from public.subject_units u
  where u.id = p_unit_id
  for update;
  if not found or v_unit.status = 'archived' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_subject
  from public.subjects s
  where s.id = v_unit.subject_id;
  if not found
     or v_subject.group_id is not null
     or v_subject.owner_teacher_id <> v_teacher
     or v_subject.status = 'archived' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(max(l.display_order), 0) + 1
  into v_order
  from public.lessons l
  where l.unit_id = p_unit_id;

  insert into public.lessons(
    unit_id, subject_id, title, description, display_order, structure_mode, status
  )
  values (
    p_unit_id, v_unit.subject_id, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    v_order, p_structure_mode, 'draft'
  )
  returning * into v_lesson;

  return v_lesson;
end;
$$;

revoke all on function public.create_unit_lesson_v2(uuid,text,text,text) from public, anon;
grant execute on function public.create_unit_lesson_v2(uuid,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Core 1.0 objective-only assessment is now enforced at the DB write edge.
--    Legacy group-scoped subjects retain their historical schema compatibility.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_core1_objective_question_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_legacy_group_id uuid;
begin
  select s.group_id
  into v_legacy_group_id
  from public.quizzes q
  left join public.lesson_parts p on p.id = q.lesson_part_id
  join public.lessons l on l.id = coalesce(q.lesson_id, p.lesson_id)
  join public.subjects s on s.id = l.subject_id
  where q.id = new.quiz_id;

  if not found then
    raise exception 'Invalid quiz';
  end if;

  if v_legacy_group_id is null and new.type not in ('mcq', 'true_false') then
    raise exception 'Core 1.0 supports MCQ and True/False only';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_core1_objective_question_v1() from public, anon, authenticated;
grant execute on function public.enforce_core1_objective_question_v1() to service_role;

drop trigger if exists enforce_core1_objective_question_v1 on public.quiz_questions;
create trigger enforce_core1_objective_question_v1
before insert or update of quiz_id, type on public.quiz_questions
for each row execute function public.enforce_core1_objective_question_v1();

commit;
