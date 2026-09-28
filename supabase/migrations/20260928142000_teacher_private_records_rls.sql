-- Teacher-local student notes are not an administration projection.
-- Keep legacy columns for compatibility, but restrict row access to the owning
-- active teacher. Service-role maintenance remains outside RLS as usual.

begin;

drop policy if exists private_admin_all on public.teacher_student_private_records;
drop policy if exists private_teacher_all_own on public.teacher_student_private_records;
drop policy if exists private_teacher_all_own_v2 on public.teacher_student_private_records;

create policy private_teacher_all_own_v2
on public.teacher_student_private_records
for all
to authenticated
using (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and teacher_id=auth.uid()
  and public.owns_group(group_id)
)
with check (
  public.session_is_current()
  and public.current_app_role()='teacher'
  and teacher_id=auth.uid()
  and public.owns_group(group_id)
);

commit;
