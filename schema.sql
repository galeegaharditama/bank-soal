-- Question bank schema, aligned with PRD "Bank Soal SD" v1.
-- Run once in Supabase -> SQL Editor.
--
-- Columns map to the PRD sheet columns 1:1:
--   mapel=subject, kelas=grade, bab=chapter, tipe=type (pg|isian), soal=prompt,
--   gambar=image_path, opsi_a..d=option_a..d, jawaban=answer, pembahasan=explanation, aktif=active
--
-- If you already ran the first version of this file, run this line once and then this file again:
-- drop table if exists public.questions;

create table public.questions (
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

create index questions_filter_idx on public.questions (subject, grade, chapter);
create index questions_active_idx on public.questions (active);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger questions_touch_updated_at
  before update on public.questions
  for each row execute function public.touch_updated_at();

-- Students read the active questions without logging in; only the editor account may write.
-- Required fields are enforced in the app, so rows saved as drafts (active = false) may be incomplete.
alter table public.questions enable row level security;

create policy "questions are readable by everyone"
  on public.questions for select
  using (true);

create policy "editors manage questions"
  on public.questions for all to authenticated
  using (true) with check (true);

-- Public bucket for question images (gambar).
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

create policy "question images are readable by everyone"
  on storage.objects for select
  using (bucket_id = 'question-images');

create policy "editors manage question images"
  on storage.objects for all to authenticated
  using (bucket_id = 'question-images')
  with check (bucket_id = 'question-images');
