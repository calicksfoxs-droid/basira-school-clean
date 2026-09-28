-- Core authoring and enrollment writes must pass through server ownership checks
-- or atomic RPCs. Teachers retain read access to their own curriculum graph and
-- memberships, but direct Data API mutation cannot bypass domain invariants.

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

-- Memberships ---------------------------------------------------------------
-- Enrollment is exclusively enroll_student_by_reference_v1; removal is a
-- server-authorized service-role mutation. Direct teacher membership writes
-- would bypass the private enrollment-reference contract.
drop policy if exists memberships_teacher_all_own on public.group_memberships;
drop policy if exists memberships_teacher_select_v2 on public.group_memberships;
create policy memberships_teacher_select_v2
on public.group_memberships
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1
    from public.groups g
    where g.id=group_memberships.group_id
      and g.owner_teacher_id=auth.uid()
  )
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

-- Lesson parts --------------------------------------------------------------
drop policy if exists parts_teacher_all on public.lesson_parts;
drop policy if exists lesson_parts_teacher_owned_v2 on public.lesson_parts;
drop policy if exists lesson_parts_teacher_select_v3 on public.lesson_parts;
create policy lesson_parts_teacher_select_v3
on public.lesson_parts
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and public.teacher_owns_lesson_v2(lesson_id)
);

-- Lesson assets -------------------------------------------------------------
-- New lesson video/handout writes finalize through upload intents. Submission
-- assets have their own student/server path and stay read-only to teachers.
drop policy if exists assets_teacher_all on public.lesson_assets;
drop policy if exists lesson_assets_teacher_owned_v2 on public.lesson_assets;
drop policy if exists lesson_assets_teacher_select_v3 on public.lesson_assets;
create policy lesson_assets_teacher_select_v3
on public.lesson_assets
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and kind<>'submission'
  and public.teacher_owns_lesson_v2(
    coalesce(
      lesson_id,
      (select p.lesson_id from public.lesson_parts p where p.id=lesson_assets.lesson_part_id)
    )
  )
);

-- Quizzes -------------------------------------------------------------------
drop policy if exists quizzes_teacher_all on public.quizzes;
drop policy if exists quizzes_teacher_owned_v2 on public.quizzes;
drop policy if exists quizzes_teacher_select_v3 on public.quizzes;
create policy quizzes_teacher_select_v3
on public.quizzes
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and public.teacher_owns_quiz(id)
);

-- Quiz questions ------------------------------------------------------------
drop policy if exists questions_teacher_all on public.quiz_questions;
drop policy if exists questions_teacher_select_v3 on public.quiz_questions;
create policy questions_teacher_select_v3
on public.quiz_questions
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and public.teacher_owns_quiz(quiz_id)
);

-- Quiz options --------------------------------------------------------------
drop policy if exists options_teacher_all on public.quiz_options;
drop policy if exists options_teacher_select_v3 on public.quiz_options;
create policy options_teacher_select_v3
on public.quiz_options
for select
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1
    from public.quiz_questions q
    where q.id=quiz_options.question_id
      and public.teacher_owns_quiz(q.quiz_id)
  )
);

commit;
