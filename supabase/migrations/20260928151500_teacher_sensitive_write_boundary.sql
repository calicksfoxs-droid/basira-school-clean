-- Sensitive teacher-visible data is mutated only by server/service-role domain paths.
-- Teachers retain scoped read access, but direct Data API writes cannot alter
-- private student records or quiz answer keys.

begin;

-- Teacher-private student records -------------------------------------------
drop policy if exists private_teacher_all_own_v2 on public.teacher_student_private_records;
drop policy if exists private_teacher_select_own_v3 on public.teacher_student_private_records;
create policy private_teacher_select_own_v3
on public.teacher_student_private_records
for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and teacher_id=(select auth.uid())
  and public.owns_group(group_id)
);

-- True/False answer keys ----------------------------------------------------
drop policy if exists question_answers_teacher on public.quiz_question_answers;
drop policy if exists question_answers_teacher_select_v2 on public.quiz_question_answers;
create policy question_answers_teacher_select_v2
on public.quiz_question_answers
for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1
    from public.quiz_questions q
    where q.id=quiz_question_answers.question_id
      and public.teacher_owns_quiz(q.quiz_id)
  )
);

-- MCQ answer keys -----------------------------------------------------------
drop policy if exists option_answers_teacher on public.quiz_option_answers;
drop policy if exists option_answers_teacher_select_v2 on public.quiz_option_answers;
create policy option_answers_teacher_select_v2
on public.quiz_option_answers
for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1
    from public.quiz_questions q
    where q.id=quiz_option_answers.question_id
      and public.teacher_owns_quiz(q.quiz_id)
  )
);

commit;
