create or replace function public.claim_tripwall_items(anon text)
returns table (
  questions_claimed integer,
  answers_claimed integer,
  itineraries_claimed integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Login required to claim TripWall items.';
  end if;

  update public.questions
     set user_id = current_user_id
   where author_anon_id = anon
     and user_id is null;
  get diagnostics questions_claimed = row_count;

  update public.answers
     set user_id = current_user_id
   where author_anon_id = anon
     and user_id is null;
  get diagnostics answers_claimed = row_count;

  update public.itineraries
     set user_id = current_user_id
   where author_anon_id = anon
     and user_id is null;
  get diagnostics itineraries_claimed = row_count;

  return next;
end;
$$;

revoke all on function public.claim_tripwall_items(text) from public;
revoke all on function public.claim_tripwall_items(text) from anon;
grant execute on function public.claim_tripwall_items(text) to authenticated;

comment on function public.claim_tripwall_items(text) is
  'Assigns unclaimed local anonymous TripWall content to the currently authenticated user.';
