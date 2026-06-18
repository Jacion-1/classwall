revoke all on function public.claim_tripwall_items(text) from public;
revoke all on function public.claim_tripwall_items(text) from anon;
grant execute on function public.claim_tripwall_items(text) to authenticated;
