-- Student progress for the lightweight learning-journey projection.
-- Completion is intentionally separate from quiz results: a lesson may be
-- completed after viewing its material even when it has no assessment.

create table if not exists public.learning_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create index if not exists learning_progress_subject_student_idx
  on public.learning_progress(subject_id, student_id, completed_at desc);

alter table public.learning_progress enable row level security;

create policy learning_progress_admin_all_v1 on public.learning_progress
for all using (public.is_admin()) with check (public.is_admin());

create policy learning_progress_student_self_v1 on public.learning_progress
for all
using (
  student_id = auth.uid()
  and public.session_is_current()
  and public.student_in_learning_subject_v1(subject_id)
)
with check (
  student_id = auth.uid()
  and public.session_is_current()
  and public.student_in_learning_subject_v1(subject_id)
  and exists (
    select 1 from public.lessons l
    where l.id = lesson_id and l.subject_id = subject_id and l.status = 'published'
  )
);

create policy learning_progress_teacher_read_v1 on public.learning_progress
for select using (public.owns_learning_subject_v1(subject_id));

