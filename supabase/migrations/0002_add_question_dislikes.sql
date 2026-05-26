-- Add dislike support for questions.
-- This migration is idempotent so existing deployments can safely run it.

alter table public.questions
  add column if not exists dislikes integer not null default 0 check (dislikes >= 0);

create table if not exists public.question_dislikes (
  question_id uuid not null references public.questions (id) on delete cascade,
  anon_id text not null,
  created_at timestamptz not null default now(),
  primary key (question_id, anon_id)
);

create index if not exists question_dislikes_question_id_idx
  on public.question_dislikes (question_id);

alter table public.question_dislikes enable row level security;

create or replace function public.increment_question_dislike(
  qid uuid,
  anon text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_dislikes integer;
begin
  insert into public.question_dislikes (question_id, anon_id)
  values (qid, anon)
  on conflict do nothing;

  if found then
    update public.questions
       set dislikes = dislikes + 1
     where id = qid
    returning dislikes into new_dislikes;
  else
    select dislikes into new_dislikes
      from public.questions
     where id = qid;
  end if;

  return new_dislikes;
end;
$$;

revoke all on function public.increment_question_dislike(uuid, text) from public;
grant execute on function public.increment_question_dislike(uuid, text) to anon, authenticated;

comment on function public.increment_question_dislike(uuid, text) is
  'Atomically insert dedup row + increment questions.dislikes. Anon-callable via supabase.rpc().';

create or replace function public.increment_question_dislike(
  anon text,
  qid uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.increment_question_dislike(qid, anon);
end;
$$;

revoke all on function public.increment_question_dislike(text, uuid) from public;
grant execute on function public.increment_question_dislike(text, uuid) to anon, authenticated;

comment on function public.increment_question_dislike(text, uuid) is
  'Alias overload for dislike RPC with swapped parameter order.';
