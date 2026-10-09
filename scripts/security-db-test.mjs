import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
const execute = promisify(execFile);
const port = process.env.LOCAL_DATABASE_PORT || "5433";
const user = process.env.LOCAL_DATABASE_USER || "reviewflow";
const database = `reviewflow_security_test_${process.pid}`;
const base = ["-h", "127.0.0.1", "-p", port, "-U", user, "-v", "ON_ERROR_STOP=1", "-qAt"];
const query = sql => execFileSync("psql", [...base, "-d", database, "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const asyncQuery = async sql => (await execute("psql", [...base, "-d", database, "-c", sql])).stdout.trim();
const a = "00000000-0000-0000-0000-000000000001", b = "00000000-0000-0000-0000-000000000002";
let created = false; let checks = 0;
function check(name, body) { body(); checks++; console.log(`PASS ${name}`); }
try {
  // No hosted credentials, no existing application data, no destructive resets.
  execFileSync("createdb", ["-h", "127.0.0.1", "-p", port, "-U", user, database]); created = true;
  query(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    insert into auth.users values('${a}'),('${b}');`);
  for (const migration of readdirSync("supabase/migrations").filter(x => x.endsWith(".sql")).sort()) {
    execFileSync("psql", [...base, "-d", database, "-f", `supabase/migrations/${migration}`], { stdio: ["ignore", "ignore", "pipe"] });
  }
  console.log("PASS all migrations applied in order to isolated PostgreSQL 16 database"); checks++;
  const databaseProof = randomBytes(32).toString("hex");
  query(`set role service_role; select security_configure_data_api('${createHash("sha256").update(databaseProof).digest("hex")}')`);
  const runAs = (owner, sql) => `set role authenticated; set request.jwt.claim.sub='${owner}'; set request.headers='{"x-reviewflow-server-proof":"${databaseProof}"}'; ${sql}`;
  query(`insert into businesses(id,user_id,name,google_review_url,slug) values('${a}','${a}','Owner A','https://g.page/r/owner_a/review','owner-a'),('${b}','${b}','Owner B','https://g.page/r/owner_b/review','owner-b'); insert into qr_codes(id,business_id,tracking_slug) values('${a}','${a}','owner-a'),('${b}','${b}','owner-b'); insert into review_snapshots(business_id,rating,total_reviews,snapshot_date,source) values('${a}',5,6,current_date,'manual_verified'),('${b}',4,10,current_date,'manual_verified');`);
  check("RLS hides another tenant on business/QR/snapshot/visits reads", () => {
    query(`select security_record_visit('${a}'); select security_record_visit('${b}');`);
    for (const table of ["businesses", "qr_codes", "review_snapshots", "qr_visit_totals"]) assert.equal(query(runAs(a, `select count(*) from ${table}`)), "1", table);
  });
  check("RLS prevents modifying another tenant and changing owners/metrics", () => {
    assert.equal(query(runAs(a, `with updated as (update businesses set name='hacked' where id='${b}' returning id) select count(*) from updated`)), "0");
    assert.throws(() => query(runAs(a, `update businesses set user_id='${b}' where id='${a}'`)));
    assert.throws(() => query(runAs(a, `insert into review_snapshots(business_id,rating,total_reviews,snapshot_date,source) values('${a}',5,999,current_date,'manual_verified')`)));
    assert.throws(() => query(runAs(a, `insert into qr_codes(business_id,tracking_slug) values('${b}','foreign-qr')`)));
    assert.throws(() => query(runAs(a, `insert into businesses(user_id,name,google_review_url,slug) values('${b}','spoof','https://g.page/r/spoof/review','spoof')`)));
  });
  check("a direct Supabase tenant token cannot bypass server quotas through the Data API", () => {
    for(const table of ["businesses","qr_codes","review_snapshots","qr_visit_totals"]) assert.equal(query(`set role authenticated; set request.jwt.claim.sub='${a}'; select count(*) from ${table}`), "0");
    assert.equal(query(`set role authenticated; set request.jwt.claim.sub='${a}'; set request.headers='{"x-reviewflow-server-proof":"forged"}'; select security_api_request_allowed()`), "f");
    assert.throws(()=>query(`set role authenticated; select * from app_data_api_guard`));
    assert.throws(()=>query(`set role authenticated; select security_configure_data_api('${"a".repeat(64)}')`));
  });
  check("anonymous and authenticated clients cannot access privileged tables/RPCs", () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["app_sessions", "rate_limit_buckets", "reviewflow_cache", "ai_jobs", "ai_spend_buckets", "qr_scans"]) assert.throws(() => query(`set role ${role}; select * from ${table}`));
      assert.throws(() => query(`set role ${role}; select security_consume_rate('${"a".repeat(64)}',3,60)`));
      assert.throws(() => query(`set role ${role}; select security_cleanup()`));
    }
  });
  const bucket = randomBytes(32).toString("hex");
  query(`select security_consume_rate('${bucket}',3,60); select security_consume_rate('${bucket}',3,60);`);
  const raced = await Promise.all(Array.from({ length: 20 }, () => asyncQuery(`set role service_role; select security_consume_rate('${bucket}',3,60)`)));
  check("20 simultaneous quota attempts allow exactly one remaining request", () => {
    assert.equal(raced.filter(x => JSON.parse(x).allowed).length, 1);
    assert.equal(query(`select request_count from rate_limit_buckets where bucket_key='${bucket}'`), "3");
  });
  check("expired window resets and denied requests never increment", () => {
    query(`update rate_limit_buckets set window_started_at=now()-interval '2 minutes' where bucket_key='${bucket}'`);
    assert.equal(JSON.parse(query(`select security_consume_rate('${bucket}',3,60)`)).allowed, true);
    assert.equal(query(`select request_count from rate_limit_buckets where bucket_key='${bucket}'`), "1");
  });
  const sessionHash = randomBytes(32).toString("hex");
  query(`insert into app_sessions(token_hash,user_id,access_cipher,refresh_cipher,token_expires_at,expires_at) values('${sessionHash}','${a}','encrypted','encrypted',now()-interval '1 minute',now()+interval '1 hour')`);
  const refresh = await Promise.all(Array.from({ length: 10 }, () => asyncQuery(`set role service_role; select security_claim_refresh('${sessionHash}')`)));
  check("refresh token rotation is claimed by exactly one instance", () => assert.equal(refresh.filter(x => x && x !== "null").length, 1));
  check("logout deletion cannot be resurrected by an in-flight refresh", () => {
    query(`delete from app_sessions where token_hash='${sessionHash}'`);
    assert.equal(query(`with saved as (update app_sessions set access_cipher='refreshed' where token_hash='${sessionHash}' returning token_hash) select count(*) from saved`), "0");
  });
  check("password-change lock invalidates sessions and rejects pre-change sign-ins", () => {
    const before = query("select security_auth_time()");
    assert.equal(query(`select security_password_lock('${a}')`), "t");
    assert.equal(query(`select security_password_lock('${a}')`), "f");
    assert.throws(() => query(`select security_insert_session('${sessionHash}','${a}','cipher','cipher',now()+interval '1 hour','${before}')`));
    query(`select security_password_unlock('${a}')`);
    assert.throws(() => query(`select security_insert_session('${sessionHash}','${a}','cipher','cipher',now()+interval '1 hour','${before}')`));
    const after = query("select security_auth_time()");
    query(`select security_insert_session('${sessionHash}','${a}','cipher','cipher',now()+interval '1 hour','${after}')`);
    assert.equal(query(`select count(*) from app_sessions`), "1");
  });
  const reserve = (key, owner, cost=40, cap=100) => `set role service_role; select security_reserve_ai('${key}','${owner}',${cost},${cap},${cap},${cap},${cap})`;
  check("sessions stay bounded when a legitimate owner signs in repeatedly", () => {
    for(let i=0;i<7;i++) query(`select security_insert_session('${randomBytes(32).toString("hex")}','${a}','cipher','cipher',now()+interval '1 hour',clock_timestamp())`);
    assert.equal(query(`select count(*) from app_sessions where user_id='${a}'`), "5");
  });
  const jobs = await Promise.all([asyncQuery(reserve("job-a", a)), asyncQuery(reserve("job-b", a))]);
  check("same account cannot run concurrent AI jobs across instances", () => assert.equal(jobs.filter(x => JSON.parse(x).allowed).length, 1));
  query(`update ai_jobs set state='failed'`);
  assert.equal(JSON.parse(query(reserve("job-c", b))).allowed, true);
  query(`update ai_jobs set state='complete'`);
  check("global budget exhaustion rejects a new user and failures retain reservations", () => {
    assert.equal(JSON.parse(query(reserve("job-d", a))).allowed, false);
    assert.equal(query(`select reserved_cents from ai_spend_buckets where bucket_key like 'global:day:%'`), "80");
  });
  check("metadata cap/TTL/owner capacity and cleanup are enforced", () => {
    assert.throws(() => query(`select security_store_cache('oversized','${a}',jsonb_build_object('large',repeat('x',70000)),60)`));
    for(let i=0;i<30;i++) query(`select security_store_cache('cache-${i}','${a}','{}',60)`);
    assert.throws(() => query(`select security_store_cache('cache-extra','${a}','{}',60)`));
    query(`update rate_limit_buckets set updated_at=now()-interval '3 days'; select security_cleanup()`);
    assert.equal(query(`select count(*) from rate_limit_buckets`), "0");
    assert.equal(query(`select public from storage.buckets where id='qr-artwork'`), "f");
  });
  check("database rejects unsupported new Google destinations", () => assert.throws(() => query(`update businesses set google_review_url='https://evil.example' where id='${a}'`)));
  check("artwork generation cannot exceed per-owner object capacity", () => {
    query(`insert into ai_jobs(cache_key,owner_id,reservation_id,state,lease_until) select 'qr:capacity-'||n,'${a}',gen_random_uuid(),'complete',now()+interval '10 minutes' from generate_series(1,10) n`);
    assert.equal(JSON.parse(query(reserve("qr:capacity-extra", a, 1,100000))).allowed,false);
  });
  check("AI job history remains bounded independently of spending configuration", () => {
    query(`insert into ai_jobs(cache_key,owner_id,reservation_id,state,lease_until) select 'capacity-'||n,'${b}',gen_random_uuid(),'complete',now()+interval '10 minutes' from generate_series(1,30) n`);
    assert.equal(JSON.parse(query(reserve("capacity-extra", b,1,100000))).allowed,false);
  });
  console.log(`${checks} database security groups passed; hosted database was not contacted.`);
} finally {
  if (created) execFileSync("dropdb", ["-h", "127.0.0.1", "-p", port, "-U", user, database]);
}
