-- PHASE 1.4: reduce the public SECURITY DEFINER execution surface
-- without changing product semantics or rewriting RLS/storage policies.
--
-- Goals:
-- - fix the two mutable search_path findings
-- - remove all anon execution of public SECURITY DEFINER functions
-- - remove authenticated direct execution from trigger-only/internal helpers
-- - preserve authenticated execution only where policies/storage rules or
--   intentional application RPCs require it
-- - retire stale authenticated access to the obsolete Phase 1.1 private helper

alter function public.set_updated_at()
  set search_path = '';

alter function public.safe_uuid(text)
  set search_path = '';

-- Remove inherited/public + explicit anon execution from all currently
-- anon-exposed public SECURITY DEFINER functions.
revoke execute on function public.can_read_lesson_object(text) from public, anon;
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.enforce_asset_parent_mode() from public, anon;
revoke execute on function public.enforce_learning_subject_owner_v1() from public, anon;
revoke execute on function public.enforce_lesson_part_mode() from public, anon;
revoke execute on function public.enforce_lesson_publish_and_mode_change() from public, anon;
revoke execute on function public.enforce_quiz_parent_mode() from public, anon;
revoke execute on function public.enforce_subject_group_owner_v1() from public, anon;
revoke execute on function public.enforce_unit_lesson_subject_v1() from public, anon;
revoke execute on function public.group_for_lesson(uuid) from public, anon;
revoke execute on function public.group_for_part(uuid) from public, anon;
revoke execute on function public.group_for_quiz(uuid) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.learning_subject_for_group_v1(uuid) from public, anon;
revoke execute on function public.owns_group(uuid) from public, anon;
revoke execute on function public.owns_learning_subject_v1(uuid) from public, anon;
revoke execute on function public.prevent_option_change_after_submission() from public, anon;
revoke execute on function public.prevent_quiz_structure_change_after_submission() from public, anon;
revoke execute on function public.session_is_current() from public, anon;
revoke execute on function public.student_can_access_lesson(uuid) from public, anon;
revoke execute on function public.student_can_access_quiz(uuid) from public, anon;
revoke execute on function public.student_can_access_storage_scope_v2(uuid) from public, anon;
revoke execute on function public.student_can_access_subject_v2(uuid) from public, anon;
revoke execute on function public.student_in_group(uuid) from public, anon;
revoke execute on function public.student_in_learning_subject_v1(uuid) from public, anon;
revoke execute on function public.teacher_can_manage_storage_scope_v2(uuid) from public, anon;
revoke execute on function public.teacher_owns_lesson_v2(uuid) from public, anon;
revoke execute on function public.teacher_owns_quiz(uuid) from public, anon;

-- Trigger-only functions do not need direct authenticated EXECUTE.
revoke execute on function public.enforce_asset_parent_mode() from authenticated;
revoke execute on function public.enforce_learning_subject_owner_v1() from authenticated;
revoke execute on function public.enforce_lesson_part_mode() from authenticated;
revoke execute on function public.enforce_lesson_publish_and_mode_change() from authenticated;
revoke execute on function public.enforce_quiz_parent_mode() from authenticated;
revoke execute on function public.enforce_subject_group_owner_v1() from authenticated;
revoke execute on function public.enforce_unit_lesson_subject_v1() from authenticated;
revoke execute on function public.prevent_option_change_after_submission() from authenticated;
revoke execute on function public.prevent_quiz_structure_change_after_submission() from authenticated;

-- Internal-only helpers are called by owner-executed SECURITY DEFINER
-- functions and are not direct authenticated API boundaries.
revoke execute on function public.group_for_quiz(uuid) from authenticated;
revoke execute on function public.learning_subject_for_group_v1(uuid) from authenticated;
revoke execute on function public.student_can_access_subject_v2(uuid) from authenticated;

-- Explicitly converge authenticated execution for helpers directly referenced
-- by RLS/storage policies.
grant execute on function public.can_read_lesson_object(text) to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.group_for_lesson(uuid) to authenticated;
grant execute on function public.group_for_part(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_group(uuid) to authenticated;
grant execute on function public.owns_learning_subject_v1(uuid) to authenticated;
grant execute on function public.session_is_current() to authenticated;
grant execute on function public.student_can_access_lesson(uuid) to authenticated;
grant execute on function public.student_can_access_quiz(uuid) to authenticated;
grant execute on function public.student_can_access_storage_scope_v2(uuid) to authenticated;
grant execute on function public.student_in_group(uuid) to authenticated;
grant execute on function public.student_in_learning_subject_v1(uuid) to authenticated;
grant execute on function public.teacher_can_manage_storage_scope_v2(uuid) to authenticated;
grant execute on function public.teacher_owns_lesson_v2(uuid) to authenticated;
grant execute on function public.teacher_owns_quiz(uuid) to authenticated;

-- Explicitly converge the intended authenticated RPC surface.
grant execute on function public.complete_learning_lesson_v1(uuid) to authenticated;
grant execute on function public.enroll_student_by_reference_v1(uuid,text) to authenticated;
grant execute on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint) to authenticated;
grant execute on function public.get_learning_journey_v1(uuid) to authenticated;
grant execute on function public.get_own_enrollment_reference_v1() to authenticated;
grant execute on function public.grade_submission_phase13a(uuid,jsonb,jsonb,boolean) to authenticated;
grant execute on function public.rotate_student_enrollment_reference_v1(uuid,text,text) to authenticated;
grant execute on function public.submit_quiz_phase13a(uuid,jsonb) to authenticated;

-- Phase 1.1 helper is obsolete after Phase 1.3 made student progress writes
-- RPC-only. Keep the function for migration-history compatibility, but remove
-- direct authenticated access to the private schema.
revoke execute on function private.learning_lesson_matches_subject_v1(uuid,uuid)
  from authenticated;

revoke usage on schema private
  from authenticated;
