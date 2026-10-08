create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists rate_limit_buckets_updated_at on public.rate_limit_buckets(updated_at);

alter table public.rate_limit_buckets enable row level security;
revoke all on table public.rate_limit_buckets from anon, authenticated;
grant all privileges on table public.rate_limit_buckets to service_role;

create policy rate_limit_buckets_no_client_access
  on public.rate_limit_buckets
  for all
  to anon, authenticated
  using (false)
  with check (false);
