-- Basira V1 — independent teachers, shared students, subject groups and units.
-- Additive compatibility migration; legacy Group -> Subject rows remain readable.

begin;

-- Subjects become the teacher-owned root for all new content.
alter table public.subjects add column if not exists owner_teacher_id uuid references public.profiles(id) on delete restrict;
alter table public.subjects add column if not exists banner_title text check (char_length(banner_title) <= 120);
alter table public.subjects add column if not exists banner_body text check (char_length(banner_body) <= 500);
alter table public.subjects add column if not exists banner_cta_label text check (char_length(banner_cta_label) <= 60);
alter table public.subjects add column if not exists banner_cta_path text check (banner_cta_path ~ '^/app(?:/.*)?$');
alter table public.subjects alter column group_id drop not null;
alter table public.subjects drop constraint if exists subjects_status_check;
-- Keep legacy `active` rows valid while all newly-created learning subjects start as drafts.
alter table public.subjects alter column status set default 'draft';
alter table public.subjects add constraint subjects_status_v1_check check (status in ('active','draft','published','archived'));
alter table public.subjects add constraint subjects_banner_cta_pair_v1_check check ((banner_cta_label is null) = (banner_cta_path is null));

update public.subjects s
set owner_teacher_id=g.owner_teacher_id
from public.groups g
where s.group_id=g.id and s.owner_teacher_id is null;

create index if not exists subjects_owner_teacher_v1_idx on public.subjects(owner_teacher_id,display_order) where owner_teacher_id is not null;

-- New groups belong to exactly one subject. Legacy groups keep subject_id NULL.
alter table public.groups add column if not exists subject_id uuid references public.subjects(id) on delete cascade;
create index if not exists groups_subject_v1_idx on public.groups(subject_id,created_at) where subject_id is not null;

create table if not exists public.subject_units (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 500),
  display_order integer not null check (display_order > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subject_id,display_order)
);
create index if not exists subject_units_subject_v1_idx on public.subject_units(subject_id,display_order);
create trigger subject_units_updated_at_v1 before update on public.subject_units
for each row execute function public.set_updated_at();

alter table public.lessons add column if not exists unit_id uuid references public.subject_units(id) on delete cascade;
alter table public.lessons drop constraint if exists lessons_status_check;
alter table public.lessons add constraint lessons_status_v1_check check (status in ('draft','published','archived'));
create index if not exists lessons_unit_v1_idx on public.lessons(unit_id,display_order) where unit_id is not null;

-- Only fingerprints and a harmless mask are persisted. The full reference is one-time reveal.
create table if not exists public.student_enrollment_references (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  masked_reference text not null check (masked_reference ~ '^BSR-S-[*]{4}[A-Z2-9]{4}$'),
  rotated_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists student_enrollment_reference_fingerprint_v1_idx on public.student_enrollment_references(fingerprint);
create unique index if not exists student_enrollment_reference_one_active_v1_idx on public.student_enrollment_references(student_id) where revoked_at is null;

create table if not exists public.platform_settings (
  id uuid primary key default '11111111-1111-1111-1111-111111111111' check (id='11111111-1111-1111-1111-111111111111'),
  platform_name text not null check (char_length(platform_name) between 2 and 80),
  timezone text not null check (char_length(timezone) between 1 and 80),
  maintenance_message text check (char_length(maintenance_message) <= 300),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger platform_settings_updated_at_v1 before update on public.platform_settings
for each row execute function public.set_updated_at();

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  reduced_motion boolean not null default false,
  locale text not null default 'ar' check (locale='ar'),
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at_v1 before update on public.user_preferences
for each row execute function public.set_updated_at();

create or replace function public.enforce_learning_subject_owner_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
  if new.group_id is not null then
    select owner_teacher_id into v_owner from public.groups where id=new.group_id;
    if v_owner is null then raise exception 'Invalid legacy group'; end if;
    new.owner_teacher_id := v_owner;
  end if;
  if new.owner_teacher_id is null or not exists(
    select 1 from public.profiles p where p.id=new.owner_teacher_id and p.role='teacher' and p.status='active'
  ) then raise exception 'A learning subject requires an active teacher owner'; end if;
  return new;
end;
$$;
create trigger enforce_learning_subject_owner_v1
before insert or update of group_id,owner_teacher_id on public.subjects
for each row execute function public.enforce_learning_subject_owner_v1();

create or replace function public.enforce_subject_group_owner_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
  if new.subject_id is null then return new; end if;
  select owner_teacher_id into v_owner from public.subjects where id=new.subject_id and group_id is null;
  if v_owner is null then raise exception 'Invalid learning subject'; end if;
  new.owner_teacher_id := v_owner;
  return new;
end;
$$;
create trigger enforce_subject_group_owner_v1
before insert or update of subject_id,owner_teacher_id on public.groups
for each row execute function public.enforce_subject_group_owner_v1();

create or replace function public.enforce_unit_lesson_subject_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_subject uuid;
begin
  if new.unit_id is null then return new; end if;
  select subject_id into v_subject from public.subject_units where id=new.unit_id;
  if v_subject is null or v_subject <> new.subject_id then raise exception 'Lesson and unit must belong to the same subject'; end if;
  return new;
end;
$$;
create trigger enforce_unit_lesson_subject_v1
before insert or update of unit_id,subject_id on public.lessons
for each row execute function public.enforce_unit_lesson_subject_v1();

-- RLS helpers deliberately bypass table RLS to avoid recursion.
create or replace function public.owns_learning_subject_v1(p_subject_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
  select public.current_app_role()='teacher' and exists(
    select 1 from public.subjects s where s.id=p_subject_id and s.owner_teacher_id=auth.uid()
  )
$$;

create or replace function public.learning_subject_for_group_v1(p_group_id uuid)
returns uuid language sql stable security definer set search_path=public as $$
  select subject_id from public.groups where id=p_group_id
$$;

create or replace function public.student_in_learning_subject_v1(p_subject_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
  select public.current_app_role()='student' and exists(
    select 1
    from public.groups g
    join public.group_memberships m on m.group_id=g.id
    join public.subjects s on s.id=g.subject_id
    where s.id=p_subject_id
      and (g.subject_id=p_subject_id or s.group_id=g.id)
      and g.status='active'
      and m.student_id=auth.uid() and m.status='active'
      and s.status in ('active','published')
  )
$$;

alter table public.subject_units enable row level security;
alter table public.student_enrollment_references enable row level security;
alter table public.platform_settings enable row level security;
alter table public.user_preferences enable row level security;

create policy subjects_admin_all_v1 on public.subjects for all using (public.is_admin()) with check (public.is_admin());
create policy subjects_teacher_owned_v1 on public.subjects for all
using (public.owns_learning_subject_v1(id))
with check (public.current_app_role()='teacher' and owner_teacher_id=auth.uid());
create policy subjects_student_enrolled_v1 on public.subjects for select
using (status in ('active','published') and public.student_in_learning_subject_v1(id));

create policy subject_units_admin_all_v1 on public.subject_units for all using (public.is_admin()) with check (public.is_admin());
create policy subject_units_teacher_owned_v1 on public.subject_units for all
using (public.owns_learning_subject_v1(subject_id))
with check (public.owns_learning_subject_v1(subject_id));
create policy subject_units_student_enrolled_v1 on public.subject_units for select
using (status='published' and public.student_in_learning_subject_v1(subject_id));

create policy lessons_admin_all_v1 on public.lessons for all using (public.is_admin()) with check (public.is_admin());
create policy lessons_teacher_owned_v1 on public.lessons for all
using (public.owns_learning_subject_v1(subject_id))
with check (public.owns_learning_subject_v1(subject_id));
create policy lessons_student_enrolled_v1 on public.lessons for select
using (status='published' and unit_id is not null and public.student_in_learning_subject_v1(subject_id));

-- Existing group policies already enforce owner_teacher_id and active membership.
create policy student_enrollment_refs_admin_v1 on public.student_enrollment_references for all using (public.is_admin()) with check (public.is_admin());
create policy user_preferences_admin_v1 on public.user_preferences for all using (public.is_admin()) with check (public.is_admin());
create policy user_preferences_self_v1 on public.user_preferences for all
using (user_id=auth.uid() and public.session_is_current())
with check (user_id=auth.uid() and public.session_is_current());
create policy platform_settings_admin_v1 on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());
create policy platform_settings_authenticated_read_v1 on public.platform_settings for select using (public.session_is_current());

create or replace function public.enroll_student_by_reference_v1(p_group_id uuid,p_reference text)
returns table(student_id uuid,display_name text)
language plpgsql security definer set search_path=public,auth as $$
declare v_normalized text; v_fingerprint text; v_student uuid;
begin
  if public.current_app_role()<>'teacher' or not public.owns_group(p_group_id) then raise exception 'Enrollment failed'; end if;
  if public.learning_subject_for_group_v1(p_group_id) is null then raise exception 'Enrollment failed'; end if;
  v_normalized := upper(trim(coalesce(p_reference,'')));
  if v_normalized !~ '^BSR-S-[A-Z2-9]{12}$' then raise exception 'Enrollment failed'; end if;
  v_fingerprint := encode(digest(convert_to(v_normalized,'UTF8'),'sha256'),'hex');
  select r.student_id into v_student
  from public.student_enrollment_references r
  join public.profiles p on p.id=r.student_id
  where r.fingerprint=v_fingerprint and r.revoked_at is null and p.role='student' and p.status='active';
  if v_student is null then raise exception 'Enrollment failed'; end if;
  insert into public.group_memberships(group_id,student_id,status)
  values(p_group_id,v_student,'active')
  on conflict(group_id,student_id) do update set status='active';
  return query select p.id,p.display_name from public.profiles p where p.id=v_student;
exception when others then
  raise exception 'Enrollment failed';
end;
$$;
revoke all on function public.enroll_student_by_reference_v1(uuid,text) from public,anon;
grant execute on function public.enroll_student_by_reference_v1(uuid,text) to authenticated;

create or replace function public.rotate_student_enrollment_reference_v1(p_student_id uuid,p_fingerprint text,p_masked_reference text)
returns table(student_id uuid,masked_reference text,rotated_at timestamptz)
language plpgsql security definer set search_path=public,auth as $$
declare v_now timestamptz := now();
begin
  if not public.session_is_current() or not (public.is_admin() or (public.current_app_role()='student' and auth.uid()=p_student_id)) then
    raise exception 'Not allowed';
  end if;
  if p_fingerprint !~ '^[0-9a-f]{64}$' or p_masked_reference !~ '^BSR-S-[*]{4}[A-Z2-9]{4}$' then raise exception 'Invalid reference metadata'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_student_id and p.role='student' and p.status='active') then raise exception 'Not allowed'; end if;
  update public.student_enrollment_references set revoked_at=v_now where student_enrollment_references.student_id=p_student_id and revoked_at is null;
  insert into public.student_enrollment_references(student_id,fingerprint,masked_reference,rotated_at)
  values(p_student_id,p_fingerprint,p_masked_reference,v_now);
  return query select p_student_id,p_masked_reference,v_now;
end;
$$;
revoke all on function public.rotate_student_enrollment_reference_v1(uuid,text,text) from public,anon;
grant execute on function public.rotate_student_enrollment_reference_v1(uuid,text,text) to authenticated;

create or replace function public.get_own_enrollment_reference_v1()
returns table(student_id uuid,masked_reference text,rotated_at timestamptz)
language sql stable security definer set search_path=public,auth as $$
  select r.student_id,r.masked_reference,r.rotated_at
  from public.student_enrollment_references r
  where public.current_app_role()='student' and r.student_id=auth.uid() and r.revoked_at is null
$$;
revoke all on function public.get_own_enrollment_reference_v1() from public,anon;
grant execute on function public.get_own_enrollment_reference_v1() to authenticated;

insert into public.platform_settings(id,platform_name,timezone)
values('11111111-1111-1111-1111-111111111111','بصيرة','Asia/Riyadh')
on conflict(id) do nothing;

grant select,insert,update,delete on public.subject_units to authenticated;
grant select,insert,update,delete on public.platform_settings to authenticated;
grant select,insert,update,delete on public.user_preferences to authenticated;
revoke all on public.student_enrollment_references from anon,authenticated;

commit;
