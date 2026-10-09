-- ReviewFlow security controls. Ordered after the existing cache/quota migrations.
-- Privileged mutation RPCs are SECURITY INVOKER and service-role-only.
-- The read-only RLS guard at the end uses a narrowly scoped definer helper.
create table public.app_auth_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reauth_after timestamptz not null default '-infinity',
  locked_until timestamptz
);
alter table public.app_auth_state enable row level security;
revoke all on public.app_auth_state from public,anon,authenticated;
grant all on public.app_auth_state to service_role;
create table public.app_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_cipher text not null check(length(access_cipher)<=16384),
  refresh_cipher text not null check(length(refresh_cipher)<=16384),
  token_expires_at timestamptz not null,
  expires_at timestamptz not null,
  refresh_lock_until timestamptz,
  created_at timestamptz not null default now()
);
create index app_sessions_user on public.app_sessions(user_id);
create index app_sessions_expiry on public.app_sessions(expires_at);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from public, anon, authenticated;
grant all on public.app_sessions to service_role;

create function public.security_auth_time() returns timestamptz language sql security invoker set search_path='' as $$select clock_timestamp()$$;
create function public.security_insert_session(p_hash text,p_user uuid,p_access text,p_refresh text,p_token_expiry timestamptz,p_started timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare s public.app_auth_state;
begin
  insert into public.app_auth_state(user_id) values(p_user) on conflict do nothing;
  select * into s from public.app_auth_state where user_id=p_user for update;
  if s.locked_until>now() or s.reauth_after>=p_started or (s.locked_until is not null and s.locked_until>=p_started) then raise exception 'authentication must restart'; end if;
  delete from public.app_sessions where user_id=p_user and expires_at<=now();
  -- A legitimate sixth sign-in replaces the oldest session, never grows storage.
  if (select count(*) from public.app_sessions where user_id=p_user)>=5 then
    delete from public.app_sessions where token_hash=(select token_hash from public.app_sessions where user_id=p_user order by created_at,token_hash limit 1);
  end if;
  insert into public.app_sessions(token_hash,user_id,access_cipher,refresh_cipher,token_expires_at,expires_at) values(p_hash,p_user,p_access,p_refresh,p_token_expiry,now()+interval '7 days');
end $$;
create function public.security_password_lock(p_user uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
  insert into public.app_auth_state(user_id) values(p_user) on conflict do nothing;
  update public.app_auth_state set locked_until=now()+interval '5 minutes',reauth_after=clock_timestamp() where user_id=p_user and (locked_until is null or locked_until<now());
  if not found then return false; end if;
  delete from public.app_sessions where user_id=p_user;
  return true;
end $$;
create function public.security_password_unlock(p_user uuid) returns void language sql security invoker set search_path='' as $$
  update public.app_auth_state set locked_until=null,reauth_after=clock_timestamp() where user_id=p_user;
$$;
revoke all on function public.security_auth_time(),public.security_insert_session(text,uuid,text,text,timestamptz,timestamptz),public.security_password_lock(uuid),public.security_password_unlock(uuid) from public,anon,authenticated;
grant execute on function public.security_auth_time(),public.security_insert_session(text,uuid,text,text,timestamptz,timestamptz),public.security_password_lock(uuid),public.security_password_unlock(uuid) to service_role;

create or replace function public.security_consume_rate(p_key text, p_limit integer, p_seconds integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare n timestamptz := clock_timestamp(); r public.rate_limit_buckets;
begin
  if p_key !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 100000 or p_seconds < 1 or p_seconds > 86400 then raise exception 'invalid quota'; end if;
  -- Bound attacker-controlled key growth as well as request counts.
  if not exists(select 1 from public.rate_limit_buckets where bucket_key=p_key) then
    perform pg_advisory_xact_lock(721180903);
    if (select count(*) from public.rate_limit_buckets)>=20000 then return jsonb_build_object('allowed',false,'retry_after',60); end if;
  end if;
  insert into public.rate_limit_buckets as b(bucket_key,window_started_at,request_count,updated_at)
  values(p_key,n,1,n)
  on conflict(bucket_key) do update set
    request_count = case when b.window_started_at + make_interval(secs => p_seconds) <= n then 1 else b.request_count + 1 end,
    window_started_at = case when b.window_started_at + make_interval(secs => p_seconds) <= n then n else b.window_started_at end,
    updated_at = n
  where b.window_started_at + make_interval(secs => p_seconds) <= n or b.request_count < p_limit
  returning * into r;
  if found then return jsonb_build_object('allowed',true,'retry_after',greatest(1,ceil(extract(epoch from r.window_started_at + make_interval(secs => p_seconds) - n)))); end if;
  select * into r from public.rate_limit_buckets where bucket_key = p_key;
  return jsonb_build_object('allowed',false,'retry_after',greatest(1,ceil(extract(epoch from r.window_started_at + make_interval(secs => p_seconds) - n))));
end $$;
revoke all on function public.security_consume_rate(text,integer,integer) from public, anon, authenticated;
grant execute on function public.security_consume_rate(text,integer,integer) to service_role;

create function public.security_claim_refresh(p_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r public.app_sessions;
begin
  update public.app_sessions set refresh_lock_until = now() + interval '60 seconds'
  where token_hash=p_hash and expires_at>now() and token_expires_at<now()+interval '60 seconds'
    and (refresh_lock_until is null or refresh_lock_until<now()) returning * into r;
  if not found then return null; end if;
  return to_jsonb(r);
end $$;
revoke all on function public.security_claim_refresh(text) from public, anon, authenticated;
grant execute on function public.security_claim_refresh(text) to service_role;

-- RLS now participates in ordinary tenant operations; clients cannot update
-- verified metrics, owner IDs, tracking slugs, or QR ownership.
grant select on public.businesses, public.qr_codes, public.review_snapshots to authenticated;
grant insert(user_id,name,google_review_url,slug,latitude,longitude,location_updated_at) on public.businesses to authenticated;
grant update(name,google_review_url,updated_at,latitude,longitude,location_updated_at) on public.businesses to authenticated;
grant insert(business_id,tracking_slug,active) on public.qr_codes to authenticated;
create policy "Owners create their business" on public.businesses for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Owners create their QR" on public.qr_codes for insert to authenticated with check (exists(select 1 from public.businesses b where b.id=business_id and b.user_id=(select auth.uid())) and active);

-- NOT VALID preserves existing data for explicit review, while enforcing all
-- new writes. Redirects also revalidate legacy destinations at runtime.
alter table public.businesses add constraint businesses_safe_google_destination
check (length(google_review_url)<=2048 and google_review_url ~ '^https://(g\.page/r/[A-Za-z0-9_-]+/review/?|maps\.app\.goo\.gl/[A-Za-z0-9_-]{5,100}(\?g_st=[A-Za-z0-9_-]+)?|((www\.|search\.|maps\.)?google\.com)/(local/writereview\?placeid=[A-Za-z0-9_-]{5,255}|maps/(place/|search/?|\?)))' and google_review_url !~ '[[:space:]\\]' and google_review_url !~* '[?&](url|redirect|redirect_uri|continue|next|target|destination)=') not valid;

-- Aggregate visits in SQL without granting raw scan/IP access to users.
create table public.qr_visit_totals (
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  visit_date date not null,
  visits bigint not null default 0 check(visits>=0),
  primary key(qr_code_id,visit_date)
);
alter table public.qr_visit_totals enable row level security;
revoke all on public.qr_visit_totals from public,anon,authenticated;
grant select on public.qr_visit_totals to authenticated;
grant all on public.qr_visit_totals to service_role;
create policy "Owners read visit totals" on public.qr_visit_totals for select to authenticated using(exists(select 1 from public.qr_codes q join public.businesses b on b.id=q.business_id where q.id=qr_code_id and b.user_id=(select auth.uid())));
insert into public.qr_visit_totals(qr_code_id,visit_date,visits)
select qr_code_id,(scanned_at at time zone 'UTC')::date,count(*) from public.qr_scans group by 1,2;
create function public.security_record_visit(p_qr uuid) returns void language sql security invoker set search_path='' as $$
  insert into public.qr_visit_totals as t(qr_code_id,visit_date,visits) values(p_qr,(now() at time zone 'UTC')::date,1)
  on conflict(qr_code_id,visit_date) do update set visits=t.visits+1;
$$;
revoke all on function public.security_record_visit(uuid) from public,anon,authenticated;
grant execute on function public.security_record_visit(uuid) to service_role;

create table public.ai_spend_buckets (
  bucket_key text primary key,
  reserved_cents bigint not null default 0 check(reserved_cents>=0),
  expires_at timestamptz not null
);
create table public.ai_jobs (
  cache_key text primary key check(length(cache_key)<=128),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid not null default gen_random_uuid(),
  lease_until timestamptz not null,
  state text not null default 'running' check(state in ('running','complete','failed'))
);
alter table public.ai_spend_buckets enable row level security;
alter table public.ai_jobs enable row level security;
revoke all on public.ai_spend_buckets,public.ai_jobs from public,anon,authenticated;
grant all on public.ai_spend_buckets,public.ai_jobs to service_role;

-- A short global lock makes budget+job reservation one transaction across all
-- instances. Never refund uncertain provider calls, including timed-out calls.
create function public.security_reserve_ai(p_key text,p_owner uuid,p_cost integer,p_global_day integer,p_global_month integer,p_user_day integer,p_user_month integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare keys text[]; caps integer[]; ends timestamptz[]; i integer; spent bigint; active_count integer; reservation uuid;
begin
  if p_cost<=0 or least(p_global_day,p_global_month,p_user_day,p_user_month)<=0 or length(p_key)>128 then return jsonb_build_object('allowed',false); end if;
  perform pg_advisory_xact_lock(721180901);
  if not exists(select 1 from public.ai_jobs where cache_key=p_key) and ((select count(*) from public.ai_jobs)>=2000 or (select count(*) from public.ai_jobs where owner_id=p_owner)>=30) then return jsonb_build_object('allowed',false); end if;
  -- Reserve finite artwork capacity before generating/uploading anything.
  if p_key like 'qr:%' and ((select count(*) from public.ai_jobs where cache_key like 'qr:%')>=100 or (select count(*) from public.ai_jobs where cache_key like 'qr:%' and owner_id=p_owner)>=10) then return jsonb_build_object('allowed',false); end if;
  if exists(select 1 from public.ai_jobs where cache_key=p_key and lease_until>now() and state='running') then return jsonb_build_object('allowed',false,'busy',true); end if;
  select count(*) into active_count from public.ai_jobs where lease_until>now() and state='running';
  if active_count>=3 or exists(select 1 from public.ai_jobs where owner_id=p_owner and lease_until>now() and state='running') then return jsonb_build_object('allowed',false,'busy',true); end if;
  keys := array['global:day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),'global:month:'||to_char(now() at time zone 'UTC','YYYY-MM'),p_owner||':day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),p_owner||':month:'||to_char(now() at time zone 'UTC','YYYY-MM')];
  caps := array[p_global_day,p_global_month,p_user_day,p_user_month];
  ends := array[date_trunc('day',now())+interval '2 days',date_trunc('month',now())+interval '2 months',date_trunc('day',now())+interval '2 days',date_trunc('month',now())+interval '2 months'];
  if (select count(*) from public.ai_spend_buckets)+(select count(*) from unnest(keys) k where not exists(select 1 from public.ai_spend_buckets b where b.bucket_key=k))>20000 then return jsonb_build_object('allowed',false); end if;
  for i in 1..4 loop
    select reserved_cents into spent from public.ai_spend_buckets where bucket_key=keys[i];
    if coalesce(spent,0)+p_cost>caps[i] then return jsonb_build_object('allowed',false); end if;
  end loop;
  for i in 1..4 loop
    insert into public.ai_spend_buckets as b(bucket_key,reserved_cents,expires_at) values(keys[i],p_cost,ends[i])
    on conflict(bucket_key) do update set reserved_cents=b.reserved_cents+p_cost;
  end loop;
  reservation := gen_random_uuid();
  insert into public.ai_jobs(cache_key,owner_id,reservation_id,lease_until,state) values(p_key,p_owner,reservation,now()+interval '10 minutes','running')
  on conflict(cache_key) do update set reservation_id=excluded.reservation_id,owner_id=excluded.owner_id,lease_until=excluded.lease_until,state='running';
  return jsonb_build_object('allowed',true,'reservation_id',reservation);
end $$;
revoke all on function public.security_reserve_ai(text,uuid,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.security_reserve_ai(text,uuid,integer,integer,integer,integer,integer) to service_role;

alter table public.reviewflow_cache add column owner_id uuid references auth.users(id) on delete cascade;
alter table public.reviewflow_cache add constraint cache_metadata_size check(pg_column_size(payload)<=65536) not valid;
create index reviewflow_cache_owner on public.reviewflow_cache(owner_id);
create function public.security_store_cache(p_key text,p_owner uuid,p_payload jsonb,p_ttl integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if length(p_key)>128 or octet_length(p_payload::text)>65536 or p_ttl<60 or p_ttl>86400 then raise exception 'invalid cache'; end if;
  perform pg_advisory_xact_lock(721180902);
  if not exists(select 1 from public.reviewflow_cache where cache_key=p_key) and
    ((select count(*) from public.reviewflow_cache)>=2000 or (select count(*) from public.reviewflow_cache where owner_id=p_owner)>=30) then raise exception 'cache capacity reached'; end if;
  insert into public.reviewflow_cache(cache_key,owner_id,payload,expires_at) values(p_key,p_owner,p_payload,now()+make_interval(secs=>p_ttl))
  on conflict(cache_key) do update set payload=excluded.payload,expires_at=excluded.expires_at,owner_id=excluded.owner_id;
end $$;
revoke all on function public.security_store_cache(text,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.security_store_cache(text,uuid,jsonb,integer) to service_role;

-- Called by the authenticated maintenance endpoint. Object storage is swept
-- separately before deleting expired metadata; bounded batches prevent long locks.
create function public.security_cleanup() returns void language sql security invoker set search_path='' as $$
  delete from public.rate_limit_buckets where bucket_key in (select bucket_key from public.rate_limit_buckets where updated_at<now()-interval '2 days' limit 20000);
  delete from public.app_sessions where token_hash in (select token_hash from public.app_sessions where expires_at<now() limit 1000);
  delete from public.ai_spend_buckets where bucket_key in (select bucket_key from public.ai_spend_buckets where expires_at<now() limit 1000);
  delete from public.ai_jobs where cache_key in (select cache_key from public.ai_jobs where lease_until<now()-interval '1 day' limit 1000);
  delete from public.qr_scans where id in (select id from public.qr_scans where scanned_at<now()-interval '90 days' limit 1000);
  delete from public.qr_visit_totals where (qr_code_id,visit_date) in (select qr_code_id,visit_date from public.qr_visit_totals where visit_date<current_date-730 limit 1000);
$$;
revoke all on function public.security_cleanup() from public,anon,authenticated;
grant execute on function public.security_cleanup() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('qr-artwork','qr-artwork',false,2097152,array['image/webp']) on conflict(id) do nothing;
-- No client storage policies are created: artwork access uses short-lived signed URLs.

create function public.security_session_capacity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(721180904);
  if (select count(*) from public.app_sessions)>=10000 or (select count(*) from public.app_sessions where user_id=new.user_id)>=5 then raise exception 'session capacity reached'; end if;
  return new;
end $$;
revoke all on function public.security_session_capacity() from public,anon,authenticated;
grant execute on function public.security_session_capacity() to service_role;
create trigger security_session_capacity before insert on public.app_sessions for each row execute function public.security_session_capacity();

-- Tenant JWTs remain subject to RLS, but cannot bypass our application quotas
-- by calling PostgREST directly. Only a server-held random proof enables access.
-- Configure its SHA-256 hash separately during the approved release procedure.
create table public.app_data_api_guard (
  singleton boolean primary key default true check(singleton),
  token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$')
);
alter table public.app_data_api_guard enable row level security;
revoke all on public.app_data_api_guard from public,anon,authenticated;
grant all on public.app_data_api_guard to service_role;
create function public.security_configure_data_api(p_hash text) returns void language sql security invoker set search_path='' as $$
  insert into public.app_data_api_guard(singleton,token_hash) values(true,p_hash) on conflict(singleton) do update set token_hash=excluded.token_hash;
$$;
revoke all on function public.security_configure_data_api(text) from public,anon,authenticated;
grant execute on function public.security_configure_data_api(text) to service_role;
-- This read-only definer helper returns only a boolean, never a credential.
-- Empty search_path and fully qualified references prevent object substitution.
create function public.security_api_request_allowed() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.app_data_api_guard g where g.token_hash=encode(sha256(convert_to((nullif(current_setting('request.headers',true),'')::jsonb)->>'x-reviewflow-server-proof','UTF8')),'hex'));
$$;
revoke all on function public.security_api_request_allowed() from public,anon,authenticated;
grant execute on function public.security_api_request_allowed() to authenticated,service_role;
create policy "Server-mediated business access" on public.businesses as restrictive for all to authenticated using((select public.security_api_request_allowed())) with check((select public.security_api_request_allowed()));
create policy "Server-mediated QR access" on public.qr_codes as restrictive for all to authenticated using((select public.security_api_request_allowed())) with check((select public.security_api_request_allowed()));
create policy "Server-mediated snapshot access" on public.review_snapshots as restrictive for select to authenticated using((select public.security_api_request_allowed()));
create policy "Server-mediated visit access" on public.qr_visit_totals as restrictive for select to authenticated using((select public.security_api_request_allowed()));
