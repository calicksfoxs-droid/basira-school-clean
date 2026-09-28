-- Low-risk Core 1.0 performance hardening after the storage and RLS repair.
-- This migration does not change product authorization semantics.

begin;

-- Recoverable storage lifecycle: cover the new foreign keys used during
-- finalize, reconciliation, and cleanup processing.
create index if not exists asset_cleanup_jobs_asset_v1_idx
  on private.asset_storage_cleanup_jobs_v1(asset_id)
  where asset_id is not null;
create index if not exists asset_upload_intents_user_v1_idx
  on private.asset_upload_intents_v1(user_id);
create index if not exists asset_upload_intents_lesson_v1_idx
  on private.asset_upload_intents_v1(lesson_id)
  where lesson_id is not null;
create index if not exists asset_upload_intents_part_v1_idx
  on private.asset_upload_intents_v1(lesson_part_id)
  where lesson_part_id is not null;
create index if not exists asset_upload_intents_final_asset_v1_idx
  on private.asset_upload_intents_v1(finalized_asset_id)
  where finalized_asset_id is not null;

-- Query-heavy public foreign keys used by student progress, quiz results,
-- resource cleanup, announcements, and teacher-private student records.
create index if not exists announcements_created_by_v1_idx
  on public.announcements(created_by);
create index if not exists announcements_group_v1_idx
  on public.announcements(group_id)
  where group_id is not null;
create index if not exists learning_progress_lesson_v1_idx
  on public.learning_progress(lesson_id);
create index if not exists lesson_assets_owner_student_v1_idx
  on public.lesson_assets(owner_student_id)
  where owner_student_id is not null;
create index if not exists lesson_assets_submission_v1_idx
  on public.lesson_assets(submission_id)
  where submission_id is not null;
create index if not exists quiz_answers_question_v1_idx
  on public.quiz_answers(question_id);
create index if not exists quiz_answers_selected_option_v1_idx
  on public.quiz_answers(selected_option_id)
  where selected_option_id is not null;
create index if not exists quiz_answers_file_asset_v1_idx
  on public.quiz_answers(file_asset_id)
  where file_asset_id is not null;
create index if not exists quiz_option_answers_option_v1_idx
  on public.quiz_option_answers(option_id);
create index if not exists private_records_group_v1_idx
  on public.teacher_student_private_records(group_id);
create index if not exists private_records_student_v1_idx
  on public.teacher_student_private_records(student_id);

-- Supabase recommends wrapping auth.uid() in SELECT inside RLS predicates so
-- PostgreSQL can initialize it once per statement instead of once per row.
-- Keep every ownership/session condition unchanged.
drop policy if exists curriculum_grades_teacher_select_v2 on public.curriculum_grades;
create policy curriculum_grades_teacher_select_v2
on public.curriculum_grades for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and owner_teacher_id=(select auth.uid())
);

drop policy if exists groups_teacher_select_v2 on public.groups;
create policy groups_teacher_select_v2
on public.groups for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and owner_teacher_id=(select auth.uid())
);

drop policy if exists memberships_teacher_select_v2 on public.group_memberships;
create policy memberships_teacher_select_v2
on public.group_memberships for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1 from public.groups g
    where g.id=group_memberships.group_id
      and g.owner_teacher_id=(select auth.uid())
  )
);

drop policy if exists subjects_teacher_select_v2 on public.subjects;
create policy subjects_teacher_select_v2
on public.subjects for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and owner_teacher_id=(select auth.uid())
);

drop policy if exists subject_units_teacher_select_v2 on public.subject_units;
create policy subject_units_teacher_select_v2
on public.subject_units for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1 from public.subjects s
    where s.id=subject_units.subject_id
      and s.owner_teacher_id=(select auth.uid())
  )
);

drop policy if exists lessons_teacher_select_v2 on public.lessons;
create policy lessons_teacher_select_v2
on public.lessons for select to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and exists (
    select 1 from public.subjects s
    where s.id=lessons.subject_id
      and s.owner_teacher_id=(select auth.uid())
  )
);

drop policy if exists private_teacher_all_own_v2 on public.teacher_student_private_records;
create policy private_teacher_all_own_v2
on public.teacher_student_private_records
for all to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and teacher_id=(select auth.uid())
  and public.owns_group(group_id)
)
with check (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and teacher_id=(select auth.uid())
  and public.owns_group(group_id)
);

commit;
