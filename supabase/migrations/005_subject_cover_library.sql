alter table public.subjects
  add column if not exists cover_key text;

alter table public.subjects
  drop constraint if exists subjects_cover_key_check;

alter table public.subjects
  add constraint subjects_cover_key_check check (
    cover_key is null or cover_key in (
      'general', 'arabic', 'english', 'mathematics', 'physics',
      'chemistry', 'biology', 'history', 'geography', 'computer'
    )
  );

comment on column public.subjects.cover_key is
  'Teacher-selected key for the built-in Basira subject cover library.';
