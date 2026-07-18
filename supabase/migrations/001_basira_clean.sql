-- Basira School Platform — clean Phase 13A schema
-- Additive foundation for a new Supabase project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  role text not null check (role in ('admin','teacher','student')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_by uuid references public.profiles(id) on delete set null,
  session_invalid_before timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create table if not exists public.access_credentials (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  public_account_ref text not null unique check (public_account_ref ~ '^[A-Z0-9]{4}$'),
  synthetic_email text not null,
  role text not null check (role in ('admin','teacher','student')),
  state text not null default 'unused' check (state in ('unused','active','disabled')),
  code_hint text not null,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  first_used_at timestamptz,
  last_reset_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists access_credentials_one_current_per_user
on public.access_credentials(auth_user_id) where state <> 'disabled';
create index if not exists access_credentials_user_idx on public.access_credentials(auth_user_id);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  owner_teacher_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','disabled','archived')),
  description text check (char_length(description) <= 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists groups_owner_idx on public.groups(owner_teacher_id);
create trigger groups_updated_at before update on public.groups
for each row execute function public.set_updated_at();

create table if not exists public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','removed')),
  joined_at timestamptz not null default now(),
  unique(group_id, student_id)
);
create index if not exists memberships_student_idx on public.group_memberships(student_id);

create table if not exists public.teacher_student_private_records (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  contact_number text check (char_length(contact_number) <= 40),
  amount_note text check (char_length(amount_note) <= 80),
  payment_note text check (char_length(payment_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(teacher_id, student_id, group_id)
);
create trigger private_records_updated_at before update on public.teacher_student_private_records
for each row execute function public.set_updated_at();

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 500),
  display_order integer not null default 1 check (display_order > 0),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subjects_group_idx on public.subjects(group_id, display_order);
create trigger subjects_updated_at before update on public.subjects
for each row execute function public.set_updated_at();

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 500),
  display_order integer not null default 1 check (display_order > 0),
  structure_mode text not null default 'direct' check (structure_mode in ('direct','parts')),
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_subject_idx on public.lessons(subject_id, display_order);
create trigger lessons_updated_at before update on public.lessons
for each row execute function public.set_updated_at();

create table if not exists public.lesson_parts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  display_order integer not null check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lesson_id, display_order)
);
create trigger lesson_parts_updated_at before update on public.lesson_parts
for each row execute function public.set_updated_at();

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade,
  lesson_part_id uuid references public.lesson_parts(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  instructions text check (char_length(instructions) <= 500),
  status text not null default 'draft' check (status in ('draft','published')),
  total_points numeric(8,2) not null default 0 check (total_points >= 0),
  has_manual_questions boolean not null default false,
  first_submission_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_one_parent check ((lesson_id is not null)::int + (lesson_part_id is not null)::int = 1)
);
create unique index if not exists one_quiz_per_lesson on public.quizzes(lesson_id) where lesson_id is not null;
create unique index if not exists one_quiz_per_part on public.quizzes(lesson_part_id) where lesson_part_id is not null;
create trigger quizzes_updated_at before update on public.quizzes
for each row execute function public.set_updated_at();

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  type text not null check (type in ('mcq','true_false','essay_text','essay_file')),
  prompt text not null check (char_length(prompt) between 2 and 500),
  points numeric(8,2) not null check (points > 0),
  display_order integer not null check (display_order > 0),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(quiz_id, display_order)
);
create trigger quiz_questions_updated_at before update on public.quiz_questions
for each row execute function public.set_updated_at();

create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  display_order integer not null check (display_order > 0),
  unique(question_id, display_order)
);

-- Correct answers are isolated from student-readable question/option tables.
create table if not exists public.quiz_question_answers (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_boolean boolean
);
create table if not exists public.quiz_option_answers (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  option_id uuid not null references public.quiz_options(id) on delete cascade
);

create table if not exists public.quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','pending_review','graded','released','void')),
  objective_score numeric(8,2) not null default 0,
  manual_score numeric(8,2) not null default 0,
  total_score numeric(8,2) not null default 0,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  released_at timestamptz,
  reset_count integer not null default 0 check (reset_count between 0 and 1)
);
create unique index if not exists one_active_attempt_per_student_quiz
on public.quiz_submissions(quiz_id, student_id) where status <> 'void';
create index if not exists submissions_quiz_idx on public.quiz_submissions(quiz_id, status);
create index if not exists submissions_student_idx on public.quiz_submissions(student_id, submitted_at desc);

create table if not exists public.lesson_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video','handout','submission')),
  lesson_id uuid references public.lessons(id) on delete cascade,
  lesson_part_id uuid references public.lesson_parts(id) on delete cascade,
  submission_id uuid references public.quiz_submissions(id) on delete cascade,
  owner_student_id uuid references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  state text not null default 'uploading' check (state in ('uploading','verifying','ready','failed','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_parent_check check (
    (kind in ('video','handout') and ((lesson_id is not null)::int + (lesson_part_id is not null)::int = 1) and submission_id is null)
    or (kind = 'submission' and submission_id is not null and owner_student_id is not null and lesson_id is null and lesson_part_id is null)
  )
);
create unique index if not exists one_active_video_per_lesson on public.lesson_assets(lesson_id) where kind='video' and state <> 'removed' and lesson_id is not null;
create unique index if not exists one_active_handout_per_lesson on public.lesson_assets(lesson_id) where kind='handout' and state <> 'removed' and lesson_id is not null;
create unique index if not exists one_active_video_per_part on public.lesson_assets(lesson_part_id) where kind='video' and state <> 'removed' and lesson_part_id is not null;
create unique index if not exists one_active_handout_per_part on public.lesson_assets(lesson_part_id) where kind='handout' and state <> 'removed' and lesson_part_id is not null;
create trigger lesson_assets_updated_at before update on public.lesson_assets
for each row execute function public.set_updated_at();

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.quiz_submissions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_option_id uuid references public.quiz_options(id) on delete restrict,
  boolean_value boolean,
  text_value text,
  file_asset_id uuid references public.lesson_assets(id) on delete set null,
  auto_score numeric(8,2) not null default 0,
  manual_score numeric(8,2),
  feedback text check (char_length(feedback) <= 500),
  unique(submission_id, question_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  creator_role text not null check (creator_role in ('admin','teacher')),
  target_type text not null check (target_type in ('global','group')),
  group_id uuid references public.groups(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 2 and 220),
  cta_label text check (char_length(cta_label) <= 40),
  cta_path text check (cta_path is null or cta_path ~ '^/app(/.*)?$'),
  is_active boolean not null default true,
  display_order integer not null default 1 check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcement_target check ((target_type='global' and group_id is null) or (target_type='group' and group_id is not null))
);
create trigger announcements_updated_at before update on public.announcements
for each row execute function public.set_updated_at();


-- Structural invariants for Direct Content versus one-level Lesson Parts.
create or replace function public.enforce_lesson_part_mode()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_mode text; v_status text;
begin
  select structure_mode,status into v_mode,v_status from public.lessons where id=new.lesson_id;
  if v_mode <> 'parts' or v_status <> 'draft' then raise exception 'Lesson parts require a draft parts-mode lesson'; end if;
  return new;
end;
$$;
create trigger enforce_lesson_part_mode_before_write before insert or update on public.lesson_parts for each row execute function public.enforce_lesson_part_mode();

create or replace function public.enforce_asset_parent_mode()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_mode text;
begin
  if new.kind='submission' then return new; end if;
  if new.lesson_id is not null then
    select structure_mode into v_mode from public.lessons where id=new.lesson_id;
    if v_mode <> 'direct' then raise exception 'Direct assets require a direct-mode lesson'; end if;
  else
    select l.structure_mode into v_mode from public.lesson_parts p join public.lessons l on l.id=p.lesson_id where p.id=new.lesson_part_id;
    if v_mode <> 'parts' then raise exception 'Part assets require a parts-mode lesson'; end if;
  end if;
  return new;
end;
$$;
create trigger enforce_asset_parent_mode_before_write before insert or update of lesson_id,lesson_part_id,kind on public.lesson_assets for each row execute function public.enforce_asset_parent_mode();

create or replace function public.enforce_quiz_parent_mode()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_mode text;
begin
  if new.lesson_id is not null then
    select structure_mode into v_mode from public.lessons where id=new.lesson_id;
    if v_mode <> 'direct' then raise exception 'Direct quiz requires a direct-mode lesson'; end if;
  else
    select l.structure_mode into v_mode from public.lesson_parts p join public.lessons l on l.id=p.lesson_id where p.id=new.lesson_part_id;
    if v_mode <> 'parts' then raise exception 'Part quiz requires a parts-mode lesson'; end if;
  end if;
  return new;
end;
$$;
create trigger enforce_quiz_parent_mode_before_write before insert or update of lesson_id,lesson_part_id on public.quizzes for each row execute function public.enforce_quiz_parent_mode();

create or replace function public.enforce_lesson_publish_and_mode_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_part record; v_has_direct boolean; v_part_count integer;
begin
  if new.structure_mode <> old.structure_mode and (
    exists(select 1 from public.lesson_parts where lesson_id=old.id) or
    exists(select 1 from public.lesson_assets where lesson_id=old.id or lesson_part_id in (select id from public.lesson_parts where lesson_id=old.id)) or
    exists(select 1 from public.quizzes where lesson_id=old.id or lesson_part_id in (select id from public.lesson_parts where lesson_id=old.id))
  ) then raise exception 'Remove or deliberately migrate content before changing lesson mode'; end if;

  if new.status='published' then
    v_has_direct := exists(select 1 from public.lesson_assets where lesson_id=new.id and state='ready') or exists(select 1 from public.quizzes where lesson_id=new.id and status='published');
    select count(*) into v_part_count from public.lesson_parts where lesson_id=new.id;
    if new.structure_mode='direct' then
      if v_part_count > 0 or not v_has_direct then raise exception 'Direct lesson needs ready direct content and no parts'; end if;
    else
      if v_has_direct or v_part_count = 0 then raise exception 'Parts lesson needs parts and no direct content'; end if;
      for v_part in select id from public.lesson_parts where lesson_id=new.id loop
        if not (exists(select 1 from public.lesson_assets where lesson_part_id=v_part.id and state='ready') or exists(select 1 from public.quizzes where lesson_part_id=v_part.id and status='published')) then
          raise exception 'Every lesson part needs ready content';
        end if;
      end loop;
    end if;
    new.published_at := coalesce(new.published_at,now());
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger enforce_lesson_publish_before_update before update of status,structure_mode on public.lessons for each row execute function public.enforce_lesson_publish_and_mode_change();

-- Authorization helpers. They never expose private data.
-- Every helper validates the JWT issued-at timestamp against the profile session
-- invalidation watermark so reset/disable revokes stale direct database access too.
create or replace function public.session_is_current()
returns boolean
language plpgsql stable security definer set search_path=public,auth
as $$
declare
  v_iat text;
begin
  if auth.uid() is null then return false; end if;
  v_iat := auth.jwt()->>'iat';
  if v_iat is null or v_iat !~ '^[0-9]+([.][0-9]+)?$' then return false; end if;
  return exists(
    select 1
    from public.profiles p
    where p.id=auth.uid()
      and p.status='active'
      and to_timestamp(v_iat::double precision) >= p.session_invalid_before - interval '1 second'
  );
exception when others then
  return false;
end;
$$;

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path=public,auth
as $$
  select role from public.profiles where id=auth.uid() and public.session_is_current()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public,auth
as $$ select coalesce(public.current_app_role()='admin', false) $$;

create or replace function public.owns_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$
  select public.current_app_role()='teacher' and exists(
    select 1 from public.groups g where g.id=p_group_id and g.owner_teacher_id=auth.uid()
  )
$$;

create or replace function public.student_in_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$
  select public.current_app_role()='student' and exists(
    select 1
    from public.group_memberships m
    join public.groups g on g.id=m.group_id
    where m.group_id=p_group_id
      and m.student_id=auth.uid()
      and m.status='active'
      and g.status='active'
  )
$$;

create or replace function public.group_for_lesson(p_lesson_id uuid)
returns uuid language sql stable security definer set search_path=public
as $$ select s.group_id from public.lessons l join public.subjects s on s.id=l.subject_id where l.id=p_lesson_id $$;

create or replace function public.group_for_part(p_part_id uuid)
returns uuid language sql stable security definer set search_path=public
as $$ select s.group_id from public.lesson_parts p join public.lessons l on l.id=p.lesson_id join public.subjects s on s.id=l.subject_id where p.id=p_part_id $$;

create or replace function public.group_for_quiz(p_quiz_id uuid)
returns uuid language sql stable security definer set search_path=public
as $$
  select coalesce(public.group_for_lesson(q.lesson_id), public.group_for_part(q.lesson_part_id)) from public.quizzes q where q.id=p_quiz_id
$$;

create or replace function public.teacher_owns_quiz(p_quiz_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select public.owns_group(public.group_for_quiz(p_quiz_id)) $$;

create or replace function public.student_can_access_lesson(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.lessons l where l.id=p_lesson_id and l.status='published' and public.student_in_group(public.group_for_lesson(l.id))) $$;

create or replace function public.student_can_access_quiz(p_quiz_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.quizzes q
    left join public.lesson_parts p on p.id=q.lesson_part_id
    join public.lessons l on l.id=coalesce(q.lesson_id,p.lesson_id)
    where q.id=p_quiz_id and q.status='published' and l.status='published' and public.student_in_group(public.group_for_quiz(q.id))
  )
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.access_credentials enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.teacher_student_private_records enable row level security;
alter table public.subjects enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_parts enable row level security;
alter table public.lesson_assets enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_question_answers enable row level security;
alter table public.quiz_option_answers enable row level security;
alter table public.quiz_submissions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.announcements enable row level security;

create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy profiles_self_select on public.profiles for select using (id=auth.uid() and public.session_is_current());
create policy profiles_teacher_students_select on public.profiles for select using (
  public.current_app_role()='teacher' and role='student' and exists(
    select 1 from public.group_memberships m join public.groups g on g.id=m.group_id
    where m.student_id=profiles.id and m.status='active' and g.owner_teacher_id=auth.uid()
  )
);

create policy credentials_admin_all on public.access_credentials for all using (public.is_admin()) with check (public.is_admin());
create policy credentials_teacher_students_select on public.access_credentials for select using (
  public.current_app_role()='teacher' and role='student' and exists(
    select 1 from public.group_memberships m join public.groups g on g.id=m.group_id
    where m.student_id=access_credentials.auth_user_id and m.status='active' and g.owner_teacher_id=auth.uid()
  )
);

create policy groups_admin_all on public.groups for all using (public.is_admin()) with check (public.is_admin());
create policy groups_teacher_all_own on public.groups for all using (public.current_app_role()='teacher' and owner_teacher_id=auth.uid()) with check (public.current_app_role()='teacher' and owner_teacher_id=auth.uid());
create policy groups_student_select on public.groups for select using (public.student_in_group(id));

create policy memberships_admin_all on public.group_memberships for all using (public.is_admin()) with check (public.is_admin());
create policy memberships_teacher_all_own on public.group_memberships for all using (public.owns_group(group_id)) with check (public.owns_group(group_id));
create policy memberships_student_select_own on public.group_memberships for select using (public.current_app_role()='student' and student_id=auth.uid());

create policy private_admin_all on public.teacher_student_private_records for all using (public.is_admin()) with check (public.is_admin());
create policy private_teacher_all_own on public.teacher_student_private_records for all using (teacher_id=auth.uid() and public.owns_group(group_id)) with check (teacher_id=auth.uid() and public.owns_group(group_id));

create policy subjects_admin_select on public.subjects for select using (public.is_admin());
create policy subjects_teacher_all on public.subjects for all using (public.owns_group(group_id)) with check (public.owns_group(group_id));
create policy subjects_student_select on public.subjects for select using (status='active' and public.student_in_group(group_id));

create policy lessons_admin_select on public.lessons for select using (public.is_admin());
create policy lessons_teacher_all on public.lessons for all using (public.owns_group(public.group_for_lesson(id))) with check (public.owns_group((select group_id from public.subjects where id=subject_id)));
create policy lessons_student_select on public.lessons for select using (status='published' and public.student_in_group(public.group_for_lesson(id)));

create policy parts_admin_select on public.lesson_parts for select using (public.is_admin());
create policy parts_teacher_all on public.lesson_parts for all using (public.owns_group(public.group_for_part(id))) with check (public.owns_group(public.group_for_lesson(lesson_id)));
create policy parts_student_select on public.lesson_parts for select using (public.student_can_access_lesson(lesson_id));

create policy assets_admin_select on public.lesson_assets for select using (public.is_admin());
create policy assets_teacher_all on public.lesson_assets for all using (
  kind <> 'submission' and public.owns_group(coalesce(public.group_for_lesson(lesson_id),public.group_for_part(lesson_part_id)))
) with check (
  kind <> 'submission' and public.owns_group(coalesce(public.group_for_lesson(lesson_id),public.group_for_part(lesson_part_id)))
);
create policy assets_teacher_submission_select on public.lesson_assets for select using (
  kind='submission' and exists(select 1 from public.quiz_submissions s where s.id=submission_id and public.teacher_owns_quiz(s.quiz_id))
);
create policy assets_student_lesson_select on public.lesson_assets for select using (
  kind in ('video','handout') and state='ready' and public.student_can_access_lesson(coalesce(lesson_id,(select lesson_id from public.lesson_parts where id=lesson_part_id)))
);
create policy assets_student_submission_select on public.lesson_assets for select using (public.current_app_role()='student' and kind='submission' and owner_student_id=auth.uid());

create policy quizzes_admin_select on public.quizzes for select using (public.is_admin());
create policy quizzes_teacher_all on public.quizzes for all using (public.teacher_owns_quiz(id)) with check (public.owns_group(coalesce(public.group_for_lesson(lesson_id),public.group_for_part(lesson_part_id))));
create policy quizzes_student_select on public.quizzes for select using (public.student_can_access_quiz(id));

create policy questions_admin_select on public.quiz_questions for select using (public.is_admin());
create policy questions_teacher_all on public.quiz_questions for all using (public.teacher_owns_quiz(quiz_id)) with check (public.teacher_owns_quiz(quiz_id));
create policy questions_student_select on public.quiz_questions for select using (public.student_can_access_quiz(quiz_id));

create policy options_admin_select on public.quiz_options for select using (public.is_admin());
create policy options_teacher_all on public.quiz_options for all using (exists(select 1 from public.quiz_questions q where q.id=question_id and public.teacher_owns_quiz(q.quiz_id))) with check (exists(select 1 from public.quiz_questions q where q.id=question_id and public.teacher_owns_quiz(q.quiz_id)));
create policy options_student_select on public.quiz_options for select using (exists(select 1 from public.quiz_questions q where q.id=question_id and public.student_can_access_quiz(q.quiz_id)));

create policy question_answers_admin on public.quiz_question_answers for all using (public.is_admin()) with check (public.is_admin());
create policy question_answers_teacher on public.quiz_question_answers for all using (exists(select 1 from public.quiz_questions q where q.id=question_id and public.teacher_owns_quiz(q.quiz_id))) with check (exists(select 1 from public.quiz_questions q where q.id=question_id and public.teacher_owns_quiz(q.quiz_id)));
create policy option_answers_admin on public.quiz_option_answers for all using (public.is_admin()) with check (public.is_admin());
create policy option_answers_teacher on public.quiz_option_answers for all using (exists(select 1 from public.quiz_questions q where q.id=question_id and public.teacher_owns_quiz(q.quiz_id))) with check (exists(select 1 from public.quiz_questions q where q.id=question_id and public.teacher_owns_quiz(q.quiz_id)));

create policy submissions_admin_select on public.quiz_submissions for select using (public.is_admin());
create policy submissions_teacher_select on public.quiz_submissions for select using (public.teacher_owns_quiz(quiz_id));
-- Student submission/result reads go through trusted server logic so pending objective scores are not directly exposed.

create policy answers_admin_select on public.quiz_answers for select using (public.is_admin());
create policy answers_teacher_select on public.quiz_answers for select using (exists(select 1 from public.quiz_submissions s where s.id=submission_id and public.teacher_owns_quiz(s.quiz_id)));
create policy answers_teacher_update on public.quiz_answers for update using (exists(select 1 from public.quiz_submissions s where s.id=submission_id and public.teacher_owns_quiz(s.quiz_id))) with check (exists(select 1 from public.quiz_submissions s where s.id=submission_id and public.teacher_owns_quiz(s.quiz_id)));
-- Student answer reads go through trusted server logic and are sanitized until result release.

create policy announcements_admin_all on public.announcements for all using (public.is_admin()) with check (public.is_admin());
create policy announcements_teacher_all_own on public.announcements for all using (creator_role='teacher' and created_by=auth.uid() and target_type='group' and public.owns_group(group_id)) with check (creator_role='teacher' and created_by=auth.uid() and target_type='group' and public.owns_group(group_id));
create policy announcements_authenticated_select on public.announcements for select using (
  is_active and (
    target_type='global' or public.owns_group(group_id) or public.student_in_group(group_id)
  )
);

-- Lock assessment structure after the first submission.
create or replace function public.prevent_quiz_structure_change_after_submission()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_quiz_id uuid;
begin
  v_quiz_id := coalesce(new.quiz_id, old.quiz_id);
  if exists(select 1 from public.quiz_submissions where quiz_id=v_quiz_id) then
    raise exception 'Quiz structure is locked after first submission';
  end if;
  return coalesce(new,old);
end;
$$;
create trigger lock_questions_before_change before insert or update or delete on public.quiz_questions for each row execute function public.prevent_quiz_structure_change_after_submission();

create or replace function public.prevent_option_change_after_submission()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_question_id uuid; v_quiz_id uuid;
begin
  v_question_id := coalesce(new.question_id, old.question_id);
  select quiz_id into v_quiz_id from public.quiz_questions where id=v_question_id;
  if exists(select 1 from public.quiz_submissions where quiz_id=v_quiz_id) then raise exception 'Quiz options are locked'; end if;
  return coalesce(new,old);
end;
$$;
create trigger lock_options_before_change before insert or update or delete on public.quiz_options for each row execute function public.prevent_option_change_after_submission();
create trigger lock_question_answers_before_change before insert or update or delete on public.quiz_question_answers for each row execute function public.prevent_option_change_after_submission();
create trigger lock_option_answers_before_change before insert or update or delete on public.quiz_option_answers for each row execute function public.prevent_option_change_after_submission();

-- Trusted student submission RPC. Correct answers remain isolated.
create or replace function public.submit_quiz_phase13a(p_quiz_id uuid, p_answers jsonb)
returns uuid
language plpgsql security definer set search_path=public,auth
as $$
declare
  v_student uuid := auth.uid();
  v_submission uuid := gen_random_uuid();
  v_has_manual boolean;
  v_objective numeric(8,2) := 0;
  v_item jsonb;
  v_question public.quiz_questions%rowtype;
  v_auto numeric(8,2);
  v_selected uuid;
begin
  if v_student is null or public.current_app_role() <> 'student' then raise exception 'Not allowed'; end if;
  if not public.student_can_access_quiz(p_quiz_id) then raise exception 'Quiz unavailable'; end if;
  if exists(select 1 from public.quiz_submissions where quiz_id=p_quiz_id and student_id=v_student and status <> 'void') then raise exception 'Quiz already submitted'; end if;
  select has_manual_questions into v_has_manual from public.quizzes where id=p_quiz_id and status='published';
  insert into public.quiz_submissions(id,quiz_id,student_id,status) values(v_submission,p_quiz_id,v_student,case when v_has_manual then 'pending_review' else 'submitted' end);

  for v_item in select value from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) loop
    select * into v_question from public.quiz_questions where id=(v_item->>'questionId')::uuid and quiz_id=p_quiz_id;
    if not found then raise exception 'Invalid question'; end if;
    v_auto := 0;
    v_selected := nullif(v_item->>'selectedOptionId','')::uuid;
    if v_question.type='mcq' then
      if v_selected is null or not exists(select 1 from public.quiz_options o where o.id=v_selected and o.question_id=v_question.id) then
        raise exception 'Invalid option';
      end if;
      if exists(select 1 from public.quiz_option_answers a where a.question_id=v_question.id and a.option_id=v_selected) then v_auto := v_question.points; end if;
    elsif v_question.type='true_false' then
      if not (v_item ? 'booleanValue') or jsonb_typeof(v_item->'booleanValue') <> 'boolean' then raise exception 'True/False answer required'; end if;
      if exists(select 1 from public.quiz_question_answers a where a.question_id=v_question.id and a.correct_boolean=(v_item->>'booleanValue')::boolean) then v_auto := v_question.points; end if;
    elsif v_question.type='essay_text' and v_question.required and char_length(trim(coalesce(v_item->>'textValue',''))) = 0 then
      raise exception 'Essay answer required';
    end if;
    insert into public.quiz_answers(submission_id,question_id,selected_option_id,boolean_value,text_value,auto_score)
    values(v_submission,v_question.id,v_selected,case when v_question.type='true_false' then (v_item->>'booleanValue')::boolean else null end,nullif(v_item->>'textValue',''),v_auto);
    v_objective := v_objective + v_auto;
  end loop;

  if (select count(*) from public.quiz_answers where submission_id=v_submission) <> (select count(*) from public.quiz_questions where quiz_id=p_quiz_id) then raise exception 'Every question requires an answer record'; end if;
  update public.quiz_submissions set objective_score=v_objective,total_score=v_objective,status=case when v_has_manual then 'pending_review' else 'released' end,released_at=case when v_has_manual then null else now() end where id=v_submission;
  update public.quizzes set first_submission_at=coalesce(first_submission_at,now()) where id=p_quiz_id;
  return v_submission;
end;
$$;
revoke all on function public.submit_quiz_phase13a(uuid,jsonb) from public,anon;
grant execute on function public.submit_quiz_phase13a(uuid,jsonb) to authenticated;

create or replace function public.grade_submission_phase13a(p_submission_id uuid,p_scores jsonb,p_feedback jsonb,p_release boolean)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_quiz uuid; v_question public.quiz_questions%rowtype; v_score numeric(8,2); v_manual numeric(8,2):=0;
begin
  select quiz_id into v_quiz from public.quiz_submissions where id=p_submission_id;
  if not found or public.current_app_role()<>'teacher' or not public.teacher_owns_quiz(v_quiz) then raise exception 'Not allowed'; end if;
  for v_question in select * from public.quiz_questions where quiz_id=v_quiz and type in ('essay_text','essay_file') loop
    if v_question.type='essay_file' and v_question.required and not exists(
      select 1
      from public.quiz_answers qa
      join public.lesson_assets la on la.id=qa.file_asset_id
      where qa.submission_id=p_submission_id
        and qa.question_id=v_question.id
        and la.kind='submission'
        and la.submission_id=p_submission_id
        and la.state='ready'
    ) then
      raise exception 'Required essay file is missing';
    end if;
    v_score := coalesce((p_scores->>v_question.id::text)::numeric,0);
    if v_score < 0 or v_score > v_question.points then raise exception 'Invalid manual score'; end if;
    update public.quiz_answers set manual_score=v_score,feedback=left(coalesce(p_feedback->>v_question.id::text,''),500) where submission_id=p_submission_id and question_id=v_question.id;
    v_manual := v_manual + v_score;
  end loop;
  update public.quiz_submissions set manual_score=v_manual,total_score=objective_score+v_manual,status=case when p_release then 'released' else 'graded' end,graded_at=now(),released_at=case when p_release then now() else null end where id=p_submission_id;
end;
$$;
revoke all on function public.grade_submission_phase13a(uuid,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.grade_submission_phase13a(uuid,jsonb,jsonb,boolean) to authenticated;


-- Atomically replace a lesson video/handout only after the new object is uploaded.
create or replace function public.finalize_lesson_asset_phase13a(
  p_kind text,
  p_lesson_id uuid,
  p_lesson_part_id uuid,
  p_title text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
returns public.lesson_assets
language plpgsql security definer set search_path=public,auth
as $$
declare
  v_group_id uuid;
  v_asset public.lesson_assets%rowtype;
begin
  if public.current_app_role() <> 'teacher' then raise exception 'Not allowed'; end if;
  if p_kind not in ('video','handout') then raise exception 'Invalid asset kind'; end if;
  if ((p_lesson_id is not null)::int + (p_lesson_part_id is not null)::int) <> 1 then raise exception 'Exactly one content parent is required'; end if;
  v_group_id := coalesce(public.group_for_lesson(p_lesson_id), public.group_for_part(p_lesson_part_id));
  if v_group_id is null or not public.owns_group(v_group_id) then raise exception 'Not allowed'; end if;

  update public.lesson_assets
  set state='removed'
  where kind=p_kind and state <> 'removed'
    and ((p_lesson_id is not null and lesson_id=p_lesson_id) or (p_lesson_part_id is not null and lesson_part_id=p_lesson_part_id));

  insert into public.lesson_assets(kind,lesson_id,lesson_part_id,title,storage_path,original_filename,mime_type,size_bytes,state)
  values(p_kind,p_lesson_id,p_lesson_part_id,left(p_title,120),p_storage_path,p_original_filename,p_mime_type,p_size_bytes,'ready')
  returning * into v_asset;
  return v_asset;
end;
$$;
revoke all on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint) from public,anon;
grant execute on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint) to authenticated;

-- Private storage buckets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('lesson-videos','lesson-videos',false,262144000,array['video/mp4','video/webm']),
 ('lesson-handouts','lesson-handouts',false,26214400,array['application/pdf']),
 ('submission-files','submission-files',false,20971520,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.safe_uuid(p_value text)
returns uuid language plpgsql immutable as $$ begin return p_value::uuid; exception when others then return null; end $$;

create or replace function public.can_read_lesson_object(p_name text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.lesson_assets a
    left join public.lesson_parts p on p.id=a.lesson_part_id
    join public.lessons l on l.id=coalesce(a.lesson_id,p.lesson_id)
    where a.storage_path=p_name and a.state='ready' and l.status='published' and public.student_in_group(public.group_for_lesson(l.id))
  )
$$;

create policy storage_admin_all on storage.objects for all using (public.is_admin()) with check (public.is_admin());
create policy storage_teacher_lesson_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('lesson-videos','lesson-handouts') and public.owns_group(public.safe_uuid(split_part(name,'/',1)))
);
create policy storage_teacher_lesson_manage on storage.objects for all to authenticated using (
  bucket_id in ('lesson-videos','lesson-handouts') and public.owns_group(public.safe_uuid(split_part(name,'/',1)))
) with check (
  bucket_id in ('lesson-videos','lesson-handouts') and public.owns_group(public.safe_uuid(split_part(name,'/',1)))
);
create policy storage_student_lesson_select on storage.objects for select to authenticated using (
  bucket_id in ('lesson-videos','lesson-handouts') and public.can_read_lesson_object(name)
);
create policy storage_student_submission_insert on storage.objects for insert to authenticated with check (
  bucket_id='submission-files' and public.current_app_role()='student' and public.safe_uuid(split_part(name,'/',3))=auth.uid() and public.student_in_group(public.safe_uuid(split_part(name,'/',1)))
);
create policy storage_submission_select on storage.objects for select to authenticated using (
  bucket_id='submission-files' and (
    (public.current_app_role()='student' and public.safe_uuid(split_part(name,'/',3))=auth.uid()) or public.owns_group(public.safe_uuid(split_part(name,'/',1))) or public.is_admin()
  )
);
