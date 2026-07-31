-- Basira — grades above subjects, with four curriculum segments.
begin;
create table if not exists public.curriculum_grades (
  id uuid primary key default gen_random_uuid(),
  owner_teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 80),
  description text check (char_length(description) <= 300),
  display_order integer not null default 1 check (display_order > 0),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_teacher_id,display_order)
);
create index if not exists curriculum_grades_owner_v1_idx on public.curriculum_grades(owner_teacher_id,display_order);
create trigger curriculum_grades_updated_at_v1 before update on public.curriculum_grades for each row execute function public.set_updated_at();
alter table public.subjects add column if not exists grade_id uuid references public.curriculum_grades(id) on delete restrict;
insert into public.curriculum_grades(owner_teacher_id,title,display_order)
select owners.owner_teacher_id,'صف غير مصنف',1 from (select distinct owner_teacher_id from public.subjects where owner_teacher_id is not null) owners
where not exists (select 1 from public.curriculum_grades g where g.owner_teacher_id=owners.owner_teacher_id and g.title='صف غير مصنف');
update public.subjects s set grade_id=g.id from public.curriculum_grades g
where s.grade_id is null and s.owner_teacher_id=g.owner_teacher_id and g.title='صف غير مصنف';
alter table public.subjects alter column grade_id set not null;
create index if not exists subjects_grade_v1_idx on public.subjects(grade_id,display_order);
alter table public.subject_units add column if not exists term_segment smallint not null default 1;
alter table public.subject_units add column if not exists cover_path text;
alter table public.subject_units drop constraint if exists subject_units_term_segment_v1_check;
alter table public.subject_units add constraint subject_units_term_segment_v1_check check (term_segment between 1 and 4);
alter table public.subject_units drop constraint if exists subject_units_cover_path_v1_check;
alter table public.subject_units add constraint subject_units_cover_path_v1_check check (cover_path is null or char_length(cover_path) <= 500);
alter table public.subject_units drop constraint if exists subject_units_subject_id_display_order_key;
alter table public.subject_units add constraint subject_units_segment_order_v1_unique unique(subject_id,term_segment,display_order);
create index if not exists subject_units_segment_v1_idx on public.subject_units(subject_id,term_segment,display_order);
alter table public.curriculum_grades enable row level security;
create policy curriculum_grades_admin_all_v1 on public.curriculum_grades for all using (public.is_admin()) with check (public.is_admin());
create policy curriculum_grades_teacher_owned_v1 on public.curriculum_grades for all using (public.current_app_role()='teacher' and owner_teacher_id=auth.uid()) with check (public.current_app_role()='teacher' and owner_teacher_id=auth.uid());
create policy curriculum_grades_student_enrolled_v1 on public.curriculum_grades for select using (
  status='active' and exists(select 1 from public.subjects s where s.grade_id=curriculum_grades.id and s.status in ('active','published') and public.student_in_learning_subject_v1(s.id))
);
grant select,insert,update,delete on public.curriculum_grades to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('unit-covers','unit-covers',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;
