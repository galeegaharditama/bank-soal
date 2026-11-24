-- Question bank schema (relational), aligned with PRD "Bank Soal SD" v1.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
--
-- subjects   mapel
-- chapters   bab milik satu mapel + satu kelas
-- questions  soal; menyimpan subject_id + grade + chapter_id (bab opsional)
--
-- Existing database with the old text columns (subject, chapter)?
--   1. export questions to CSV (backup)
--   2. run THIS file
--   3. run migration-relations.sql
-- Fresh database: cukup file ini.

create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists subjects_name_key on public.subjects (lower(name));

create table if not exists public.chapters (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects (id) on delete restrict,
  grade       smallint not null check (grade between 1 and 6),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, subject_id, grade)
);

create unique index if not exists chapters_scope_key on public.chapters (subject_id, grade, lower(name));

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid references public.subjects (id) on delete restrict,
  chapter_id  uuid,
  grade       smallint check (grade between 1 and 6),
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

-- Existing tables from the flat version: add the relation columns.
alter table public.questions
  add column if not exists subject_id uuid references public.subjects (id) on delete restrict;
alter table public.questions
  add column if not exists chapter_id uuid;

create index if not exists questions_subject_idx on public.questions (subject_id);
create index if not exists questions_chapter_idx on public.questions (chapter_id);
create index if not exists questions_active_idx on public.questions (active);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists subjects_touch_updated_at on public.subjects;
create trigger subjects_touch_updated_at
  before update on public.subjects
  for each row execute function public.touch_updated_at();

drop trigger if exists chapters_touch_updated_at on public.chapters;
create trigger chapters_touch_updated_at
  before update on public.chapters
  for each row execute function public.touch_updated_at();

drop trigger if exists questions_touch_updated_at on public.questions;
create trigger questions_touch_updated_at
  before update on public.questions
  for each row execute function public.touch_updated_at();

-- A question can only point at a chapter of the same mapel and kelas.
alter table public.questions drop constraint if exists questions_chapter_fk;
alter table public.questions
  add constraint questions_chapter_fk
  foreign key (chapter_id, subject_id, grade)
  references public.chapters (id, subject_id, grade)
  on delete restrict;

-- Students read everything without logging in; only the editor account may write.
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.questions enable row level security;

drop policy if exists "subjects are readable by everyone" on public.subjects;
create policy "subjects are readable by everyone"
  on public.subjects for select
  using (true);

drop policy if exists "editors manage subjects" on public.subjects;
create policy "editors manage subjects"
  on public.subjects for all to authenticated
  using (true) with check (true);

drop policy if exists "chapters are readable by everyone" on public.chapters;
create policy "chapters are readable by everyone"
  on public.chapters for select
  using (true);

drop policy if exists "editors manage chapters" on public.chapters;
create policy "editors manage chapters"
  on public.chapters for all to authenticated
  using (true) with check (true);

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
