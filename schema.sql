-- Question bank schema, aligned with PRD "Bank Soal SD" v1.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
--
-- Columns are English; the editor and the CSV import use the Indonesian PRD names
-- (mapel, kelas, bab, tipe, soal, gambar, opsi_a..d, jawaban, pembahasan, aktif)
-- and translate in src/data/SupabaseQuestionRepository.js and src/data/csv.js.
--
-- Starting over from an older column layout? Run this first, then this whole file:
-- drop table if exists public.questions;

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  subject     text,
  grade       smallint check (grade between 1 and 6),
  chapter     text,
  type        text check (type in ('pg', 'isian')),
  prompt      text,
  image_path  text,
  option_a    text,
  option_b    text,
  option_c    text,
  option_d    text,
  answer      text,
  explanation text,
  active      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists questions_filter_idx on public.questions (subject, grade, chapter);
create index if not exists questions_active_idx on public.questions (active);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists questions_touch_updated_at on public.questions;

create trigger questions_touch_updated_at
  before update on public.questions
  for each row execute function public.touch_updated_at();

-- Students read the active questions without logging in; only the editor account may write.
-- Required fields are enforced in the app, so rows saved as drafts (active = false) may be incomplete.
alter table public.questions enable row level security;

drop policy if exists "questions are readable by everyone" on public.questions;
create policy "questions are readable by everyone"
  on public.questions for select
  using (true);

drop policy if exists "editors manage questions" on public.questions;
create policy "editors manage questions"
  on public.questions for all to authenticated
  using (true) with check (true);

-- Public bucket for question images (gambar).
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists "question images are readable by everyone" on storage.objects;
create policy "question images are readable by everyone"
  on storage.objects for select
  using (bucket_id = 'question-images');

drop policy if exists "editors manage question images" on storage.objects;
create policy "editors manage question images"
  on storage.objects for all to authenticated
  using (bucket_id = 'question-images')
  with check (bucket_id = 'question-images');
