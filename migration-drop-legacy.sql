-- Run ONCE, after migration-relations.sql, when both counts it printed are 0.
-- Puts the legacy text columns out of the way; everything now lives in subjects/chapters.

begin;

alter table public.questions drop column if exists subject;
alter table public.questions drop column if exists chapter;

commit;
