create policy reviewflow_cache_no_client_access
  on public.reviewflow_cache
  for all
  to anon, authenticated
  using (false)
  with check (false);
