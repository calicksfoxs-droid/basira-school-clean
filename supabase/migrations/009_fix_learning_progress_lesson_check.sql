-- PHASE 1.1 follow-up: make lesson/subject validation independent of
-- the caller's SELECT visibility on public.lessons.
--
-- Migration 008 fixed the accidental subject self-comparison. This migration
-- moves the cross-table integrity check behind a narrowly-scoped SECURITY
-- DEFINER helper in a non-exposed schema so the policy can verify the lesson
-- row even when lesson RLS correctly hides it from the caller.

create schema if not exists private;

create or replace function private.learning_lesson_matches_subject_v1(
  p_lesson_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons l
    where l.id = p_lesson_id
      and l.subject_id = p_subject_id
      and l.status = 'published'
  );
$$;

revoke all on function private.learning_lesson_matches_subject_v1(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.learning_lesson_matches_subject_v1(uuid, uuid) to authenticated;

drop policy if exists learning_progress_student_self_v1
  on public.learning_progress;

create policy learning_progress_student_self_v1
on public.learning_progress
for all
to authenticated
using (
  learning_progress.student_id = (select auth.uid())
  and (select public.session_is_current())
  and public.student_in_learning_subject_v1(learning_progress.subject_id)
)
with check (
  learning_progress.student_id = (select auth.uid())
  and (select public.session_is_current())
  and public.student_in_learning_subject_v1(learning_progress.subject_id)
  and private.learning_lesson_matches_subject_v1(
    learning_progress.lesson_id,
    learning_progress.subject_id
  )
);
