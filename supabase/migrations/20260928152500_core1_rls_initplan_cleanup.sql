-- Finish low-risk RLS init-plan cleanup and cover the remaining foreign keys.
-- Policies keep the same actor/ownership conditions while scoping user policies
-- explicitly to authenticated sessions and caching auth.uid() per statement.

begin;

create index if not exists access_credentials_issued_by_v1_idx
  on public.access_credentials(issued_by)
  where issued_by is not null;
create index if not exists groups_created_by_v1_idx
  on public.groups(created_by)
  where created_by is not null;
create index if not exists platform_settings_updated_by_v1_idx
  on public.platform_settings(updated_by)
  where updated_by is not null;
create index if not exists profiles_created_by_v1_idx
  on public.profiles(created_by)
  where created_by is not null;

-- Profile self-read ----------------------------------------------------------
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles for select to authenticated
using (
  id=(select auth.uid())
  and public.session_is_current()
);

-- Teacher visibility of enrolled students ----------------------------------
drop policy if exists profiles_teacher_students_select on public.profiles;
create policy profiles_teacher_students_select
on public.profiles for select to authenticated
using (
  public.current_app_role()='teacher'
  and role='student'
  and exists (
    select 1
    from public.group_memberships m
    join public.groups g on g.id=m.group_id
    where m.student_id=profiles.id
      and m.status='active'
      and g.owner_teacher_id=(select auth.uid())
  )
);

-- Teacher visibility of student credential metadata -------------------------
drop policy if exists credentials_teacher_students_select on public.access_credentials;
create policy credentials_teacher_students_select
on public.access_credentials for select to authenticated
using (
  public.current_app_role()='teacher'
  and role='student'
  and exists (
    select 1
    from public.group_memberships m
    join public.groups g on g.id=m.group_id
    where m.student_id=access_credentials.auth_user_id
      and m.status='active'
      and g.owner_teacher_id=(select auth.uid())
  )
);

-- Student membership self-read ---------------------------------------------
drop policy if exists memberships_student_select_own on public.group_memberships;
create policy memberships_student_select_own
on public.group_memberships for select to authenticated
using (
  public.current_app_role()='student'
  and student_id=(select auth.uid())
);

-- Student submission-asset self-read ---------------------------------------
drop policy if exists assets_student_submission_select on public.lesson_assets;
create policy assets_student_submission_select
on public.lesson_assets for select to authenticated
using (
  public.current_app_role()='student'
  and kind='submission'
  and owner_student_id=(select auth.uid())
);

-- Teacher announcement authoring -------------------------------------------
drop policy if exists announcements_teacher_all_own on public.announcements;
create policy announcements_teacher_all_own
on public.announcements for all to authenticated
using (
  creator_role='teacher'
  and created_by=(select auth.uid())
  and target_type='group'
  and public.owns_group(group_id)
)
with check (
  creator_role='teacher'
  and created_by=(select auth.uid())
  and target_type='group'
  and public.owns_group(group_id)
);

-- User preference self-management ------------------------------------------
drop policy if exists user_preferences_self_v1 on public.user_preferences;
create policy user_preferences_self_v1
on public.user_preferences for all to authenticated
using (
  user_id=(select auth.uid())
  and public.session_is_current()
)
with check (
  user_id=(select auth.uid())
  and public.session_is_current()
);

commit;
