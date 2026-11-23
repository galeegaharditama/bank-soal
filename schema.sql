-- Question bank schema. Run once in Supabase -> SQL Editor.
-- Free tier is enough: one row is ~1 KB, so 500 MB holds hundreds of thousands of rows.

create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  topic       text,
  type        text not null default 'multiple_choice'
                check (type in ('multiple_choice', 'short_answer')),
  prompt      text not null,
  option_a    text,
  option_b    text,
  option_c    text,
  option_d    text,
  answer      text not null,
  explanation text,
  image_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index questions_subject_idx on public.questions (subject);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger questions_touch_updated_at
  before update on public.questions
  for each row execute function public.touch_updated_at();

-- Row level security: the quiz is readable without login, writes need a logged-in editor.
alter table public.questions enable row level security;

create policy "questions are readable by everyone"
  on public.questions for select
  using (true);

create policy "editors manage questions"
  on public.questions for all to authenticated
  using (true) with check (true);

-- Public bucket for question images.
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
