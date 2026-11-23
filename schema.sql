-- Question bank schema, aligned with PRD "Bank Soal SD" v1.
-- Run once in Supabase -> SQL Editor.
--
-- Column names follow the PRD sheet exactly, so a sheet export can be imported without renaming:
--   mapel, kelas, bab, tipe (pg|isian), soal, gambar, opsi_a..opsi_d, jawaban, pembahasan, aktif
--
-- If you already ran an earlier version of this file, run this line once and then this file again:
-- drop table if exists public.questions;

create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  mapel       text,
  kelas       smallint check (kelas between 1 and 6),
  bab         text,
  tipe        text check (tipe in ('pg', 'isian')),
  soal        text,
  gambar      text,
  opsi_a      text,
  opsi_b      text,
  opsi_c      text,
  opsi_d      text,
  jawaban     text,
  pembahasan  text,
  aktif       boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index questions_filter_idx on public.questions (mapel, kelas, bab);
create index questions_active_idx on public.questions (aktif);

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
-- Required fields are enforced in the app, so rows saved as drafts (aktif = false) may be incomplete.
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
