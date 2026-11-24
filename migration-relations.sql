-- Run ONCE, after schema.sql, on a database that still has the flat columns
-- questions.subject and questions.chapter.
--
--   1. export public.questions to CSV (the free plan has no automatic backups)
--   2. run this file
--   3. check the two numbers printed at the end: both must be 0
--   4. then run migration-drop-legacy.sql
--
-- Matching ignores case and surrounding spaces, so "Matematika" and " matematika "
-- become one subject. Different spellings stay apart — rename them in the taxonomy page.

begin;

insert into public.subjects (name)
select distinct on (lower(trim(subject))) trim(subject)
from public.questions
where subject is not null and trim(subject) <> ''
order by lower(trim(subject)), trim(subject);

insert into public.chapters (subject_id, grade, name)
select distinct on (s.id, q.grade, lower(trim(q.chapter))) s.id, q.grade, trim(q.chapter)
from public.questions q
join public.subjects s on lower(s.name) = lower(trim(q.subject))
where trim(coalesce(q.chapter, '')) <> '' and q.grade is not null
order by s.id, q.grade, lower(trim(q.chapter));

update public.questions q
set subject_id = s.id
from public.subjects s
where q.subject_id is null and lower(s.name) = lower(trim(q.subject));

update public.questions q
set chapter_id = c.id
from public.chapters c
where q.chapter_id is null
  and c.subject_id = q.subject_id
  and c.grade = q.grade
  and lower(c.name) = lower(trim(q.chapter));

commit;

-- Both must be 0 before you continue.
select count(*) as mapel_tidak_terhubung
from public.questions
where trim(coalesce(subject, '')) <> '' and subject_id is null;

select count(*) as bab_tidak_terhubung
from public.questions
where trim(coalesce(chapter, '')) <> ''
  and grade is not null
  and chapter_id is null;
