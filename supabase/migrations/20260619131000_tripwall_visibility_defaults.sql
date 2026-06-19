update public.questions
   set is_hidden = false
 where is_hidden is null;

update public.answers
   set is_hidden = false
 where is_hidden is null;

update public.itineraries
   set is_hidden = false
 where is_hidden is null;

alter table public.questions
  alter column is_hidden set default false;

alter table public.answers
  alter column is_hidden set default false;

alter table public.itineraries
  alter column is_hidden set default false;