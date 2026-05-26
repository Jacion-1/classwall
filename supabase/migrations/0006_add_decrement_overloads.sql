-- Add swapped-argument overloads for decrement RPCs
-- Idempotent migration: create or replace functions that forward to canonical signature

create or replace function public.decrement_question_like(
  anon text,
  qid uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.decrement_question_like(qid, anon);
end;
$$;

revoke all on function public.decrement_question_like(text, uuid) from public;
grant execute on function public.decrement_question_like(text, uuid) to anon, authenticated;

comment on function public.decrement_question_like(text, uuid) is
  'Alias overload for decrement RPC with anon parameter first.';

create or replace function public.decrement_question_dislike(
  anon text,
  qid uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.decrement_question_dislike(qid, anon);
end;
$$;

revoke all on function public.decrement_question_dislike(text, uuid) from public;
grant execute on function public.decrement_question_dislike(text, uuid) to anon, authenticated;

comment on function public.decrement_question_dislike(text, uuid) is
  'Alias overload for decrement dislike RPC with anon parameter first.';
