create table if not exists public.reviewflow_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists reviewflow_cache_expires_at on public.reviewflow_cache(expires_at);

alter table public.reviewflow_cache enable row level security;

revoke all on table public.reviewflow_cache from anon, authenticated;
grant all privileges on table public.reviewflow_cache to service_role;
