-- PHASE 1.1: repair learning_progress student write integrity.
-- The original policy used an unqualified subject_id inside the lesson
-- subquery. PostgreSQL resolved that identifier to lessons.subject_id,
-- collapsing the intended correlation into l.subject_id = l.subject_id.
--
-- Keep this as an additive migration so existing deployments and fresh
-- rebuilds converge without rewriting migration history.

drop policy if exists learning_progress_student_self_v1
  on public.learning_progress;

create policy learning_progress_student_self_v1
on public.learning_progress
for all
using (
  learning_progress.student_id = auth.uid()
  and public.session_is_current()
  and public.student_in_learning_subject_v1(learning_progress.subject_id)
)
with check (
  learning_progress.student_id = auth.uid()
  and public.session_is_current()
  and public.student_in_learning_subject_v1(learning_progress.subject_id)
  and exists (
    select 1
    from public.lessons l
    where l.id = learning_progress.lesson_id
      and l.subject_id = learning_progress.subject_id
      and l.status = 'published'
  )
);
