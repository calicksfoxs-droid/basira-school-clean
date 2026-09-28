-- Core authoring writes must pass through server ownership checks or atomic RPCs.
-- Teachers retain read access to their own curriculum graph, but direct Data API
-- INSERT/UPDATE/DELETE can no longer bypass ordering, graph, and publish invariants.

begin;

-- Curriculum grades ---------------------------------------------------------
drop policy if exists curriculum_grades_teacher_owned_v1 on public.curriculum_grades;
drop policy if exists curriculum_grades_teacher_select_v2 on public.curriculum_grades;
create policy curriculum_grades_teacher_select_v2
on public.curriculum_grades
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and owner_teacher_id=auth.uid()
);

-- Groups --------------------------------------------------------------------
drop policy if exists groups_teacher_all_own on public.groups;
drop policy if exists groups_teacher_select_v2 on public.groups;
create policy groups_teacher_select_v2
on public.groups
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and owner_teacher_id=auth.uid()
);

-- Subjects ------------------------------------------------------------------
drop policy if exists subjects_teacher_all on public.subjects;
drop policy if exists subjects_teacher_owned_v1 on public.subjects;
drop policy if exists subjects_teacher_select_v2 on public.subjects;
create policy subjects_teacher_select_v2
on public.subjects
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and owner_teacher_id=auth.uid()
);

-- Subject units -------------------------------------------------------------
drop policy if exists subject_units_teacher_owned_v1 on public.subject_units;
drop policy if exists subject_units_teacher_select_v2 on public.subject_units;
create policy subject_units_teacher_select_v2
on public.subject_units
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1
    from public.subjects s
    where s.id=subject_units.subject_id
      and s.owner_teacher_id=auth.uid()
  )
);

-- Lessons -------------------------------------------------------------------
drop policy if exists lessons_teacher_all on public.lessons;
drop policy if exists lessons_teacher_owned_v1 on public.lessons;
drop policy if exists lessons_teacher_select_v2 on public.lessons;
create policy lessons_teacher_select_v2
on public.lessons
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1
    from public.subjects s
    where s.id=lessons.subject_id
      and s.owner_teacher_id=auth.uid()
  )
);

commit;
