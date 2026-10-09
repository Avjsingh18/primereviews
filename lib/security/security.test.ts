import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, readJson, safeRoute, HttpError } from "./http";
import { isGoogleReviewUrl } from "./google-url";
import { dateWindow } from "./analytics";
import { requestRateLimitKey, consumeRateLimit } from "../rate-limit";
import { encryptToken, decryptToken, issueSession, loadSession, revokeSession, sessionCookie } from "./session";
import { aiConfiguration, reserveAi } from "./ai";
import { checkNewPassword } from "./password";

process.env.NEXT_PUBLIC_SITE_URL = "https://app.example";
process.env.RATE_LIMIT_SECRET = randomBytes(32).toString("hex");
process.env.SESSION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const request = (method = "POST", body = "{}", origin = "https://app.example") => new NextRequest("https://app.example/api/business", { method, ...(method === "GET" ? {} : { body }), headers: { origin, "content-type": "application/json" } });

test("same-origin writes only; reject missing/foreign Origin and form CSRF", () => {
  assert.doesNotThrow(() => assertSameOrigin(request()));
  assert.throws(() => assertSameOrigin(request("POST", "{}", "https://evil.example")), /not allowed/);
  assert.throws(() => assertSameOrigin(new NextRequest("https://app.example/api/auth/login", { method: "POST" })), /not allowed/);
  assert.throws(() => assertSameOrigin(new NextRequest("https://app.example/api/auth/login", { method: "POST", headers: { origin: "https://app.example", "content-type": "text/plain" } })), /JSON/);
});
test("streamed body caps and null/arrays/invalid JSON are controlled errors", async () => {
  for (const body of ["null", "[]", "not-json"]) await assert.rejects(() => readJson(request("POST", body)), (e: unknown) => e instanceof HttpError && e.status === 400);
  await assert.rejects(() => readJson(request("POST", JSON.stringify({ text: "x".repeat(9000) }))), (e: unknown) => e instanceof HttpError && e.status === 413);
  assert.deepEqual(await readJson(request()), {});
});
test("provider exceptions never leak credentials and responses are no-store", async () => {
  const handler = safeRoute(async () => { throw new Error("SECRET_PROVIDER_KEY_do_not_leak"); });
  const response = await handler(request());
  assert.equal(response.status, 503); assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.doesNotMatch(await response.text(), /SECRET_PROVIDER_KEY/);
});
test("a stalled body is cancelled rather than holding a function indefinitely", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  await assert.rejects(() => readJson({ body, headers:new Headers() }, 8192, 5), (e: unknown) => e instanceof HttpError && e.status === 408);
  assert.equal(cancelled, true);
});
test("Google destinations allow known formats and reject redirect/external/ambiguous URLs", () => {
  for (const url of ["https://g.page/r/valid_id/review", "https://maps.app.goo.gl/Abcd12345", "https://search.google.com/local/writereview?placeid=ChIJ_test_id", "https://www.google.com/maps/search/?api=1&query=R.SERTO+NURSERY+Manipur"]) assert.equal(isGoogleReviewUrl(url), true, url);
  for (const url of ["http://g.page/r/a/review", "https://evil.example/", "https://www.google.com/url?q=https://evil.example", "https://www.google.com/maps/search/?%75rl=https://evil.example", "https://google.com@evil.example/maps/place/X", "https://google.com:444/maps/place/X", "https://google.com.evil.example/maps/place/X", "javascript:alert(1)", "https://maps.google.com/maps/place/X#fragment", "https://maps.google.com/maps/place/X?redirect=https://evil.example", "https://g.page/r/x/review\n"]) assert.equal(isGoogleReviewUrl(url), false, url);
});
test("analytics invalid/future/unbounded ranges rejected", () => {
  const dateRequest = (q: string) => new NextRequest(`https://app.example/api/analytics/scans?${q}`);
  for (const query of ["start=2000-01-01&end=2026-01-01", "start=2026-02-30", "end=2999-01-01", "start=bad", "start=2026-10-01&end=2026-09-01"]) assert.throws(() => dateWindow(dateRequest(query)), /date range/);
  assert.ok(dateWindow(dateRequest("")).start);
});
test("account quota key does not change with IP; separate IP quota does", () => {
  const first = new NextRequest("https://app.example", { headers: { "x-real-ip": "192.0.2.1" } });
  const second = new NextRequest("https://app.example", { headers: { "x-real-ip": "192.0.2.2" } });
  assert.equal(requestRateLimitKey(first, "user", "owner"), requestRateLimitKey(second, "user", "owner"));
  assert.notEqual(requestRateLimitKey(first, "ip"), requestRateLimitKey(second, "ip"));
  const accountKey = requestRateLimitKey(first, "user", "email@example.com");
  assert.match(accountKey, /^[a-f0-9]{64}$/);
  assert.notEqual(accountKey, "email@example.com");
  assert.notEqual(accountKey, "192.0.2.1");
});
test("encrypted session tokens resist tampering and cross-session substitution", () => {
  const encrypted = encryptToken("provider-access-token", "one:access");
  assert.equal(decryptToken(encrypted, "one:access"), "provider-access-token");
  assert.doesNotMatch(encrypted, /provider-access-token/);
  assert.throws(() => decryptToken(encrypted, "two:access"));
  const bytes = Buffer.from(encrypted, "base64url"); bytes[15] ^= 1;
  assert.throws(() => decryptToken(bytes.toString("base64url"), "one:access"));
});
test("AI fails closed with missing configuration or local connectivity", () => {
  delete process.env.AI_ENABLED;
  assert.throws(() => aiConfiguration("qr"), /unavailable/);
  process.env.AI_ENABLED = "true"; process.env.AI_PRICING_VERIFIED = "true"; process.env.OPENAI_API_KEY = "test-placeholder";
  assert.throws(() => aiConfiguration("qr"), /spending protection/);
  process.env.REVIEWFLOW_LOCAL_BACKEND = "true";
  assert.throws(() => aiConfiguration("qr"), /unavailable/);
  delete process.env.REVIEWFLOW_LOCAL_BACKEND;
});
test("password checks send only a hash prefix, reject breaches and provider outages", async () => {
  const saved = global.fetch; const password = "a-long-unique-test-password";
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  global.fetch = async (input, init) => {
    assert.equal(String(input), `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
    assert.ok(!init?.body); return new Response(`${hash.slice(5)}:3\r\n`);
  };
  try {
    await assert.rejects(() => checkNewPassword(password), /data breach/);
    global.fetch = async () => new Response("", { status: 500 });
    await assert.rejects(() => checkNewPassword(password), /unavailable/);
    await assert.rejects(() => checkNewPassword("short"), /12 characters/);
  } finally { global.fetch = saved; }
});
test("rate limiter fails closed on unavailable RPC", async () => {
  const saved = global.fetch; global.fetch = async () => new Response("", { status: 503 });
  try { const result = await consumeRateLimit("a".repeat(64), 3, 60); assert.equal(result.allowed, false); assert.equal(result.unavailable, true); } finally { global.fetch = saved; }
});

test("opaque session replay fails after logout; provider tokens never reach cookies", async () => {
  const saved = global.fetch; let row: Record<string, unknown> | null = null; let providerSignouts = 0;
  global.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/security_insert_session")) {
      const v = JSON.parse(String(init!.body));
      row = { token_hash: v.p_hash, user_id: v.p_user, access_cipher: v.p_access, refresh_cipher: v.p_refresh, token_expires_at: v.p_token_expiry, expires_at: new Date(Date.now()+3600000).toISOString() };
      return new Response(null, { status: 204 });
    }
    if (path.endsWith("/app_sessions")) {
      if (init?.method === "POST") { row = JSON.parse(String(init.body)); return new Response(null, { status: 201 }); }
      if (init?.method === "DELETE") { const deleted = row; row = null; return Response.json(deleted); }
      return Response.json(row ? [row] : []);
    }
    if (path.endsWith("/logout")) { providerSignouts++; return Response.json({}); }
    throw new Error("Unexpected fixture operation");
  };
  try {
    const response = NextResponse.json({});
    await issueSession(response, { access_token: "fixture-provider-access", refresh_token: "fixture-provider-refresh", expires_at: Math.floor(Date.now()/1000)+3600, user: { id: "00000000-0000-0000-0000-000000000001" } } as never, new Date().toISOString());
    const cookie = response.cookies.get(sessionCookie)!.value;
    assert.equal(cookie.length, 43); assert.doesNotMatch(response.headers.get("set-cookie")!, /fixture-provider/);
    assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
    if(process.env.NODE_ENV === "production") {
      assert.match(sessionCookie,/^__Host-/);
      assert.match(response.headers.get("set-cookie")!,/Secure/);
      assert.match(response.headers.get("set-cookie")!,/SameSite=lax/i);
    }
    assert.equal(String(row!.token_hash), createHash("sha256").update(cookie).digest("hex"));
    assert.notEqual(row!.access_cipher, "fixture-provider-access");
    const req = new NextRequest("https://app.example/api/business", { headers: { cookie: `${sessionCookie}=${cookie}` } });
    assert.equal((await loadSession(req))!.accessToken, "fixture-provider-access");
    await revokeSession(req);
    assert.equal(await loadSession(req), null); assert.equal(providerSignouts, 1);
  } finally { global.fetch = saved; }
});
test("budget exhaustion prevents any provider call", async () => {
  const saved = global.fetch; let calls = 0;
  for (const name of ["AI_QR_MAX_CALL_CENTS", "AI_GLOBAL_DAILY_CENTS", "AI_GLOBAL_MONTHLY_CENTS", "AI_USER_DAILY_CENTS", "AI_USER_MONTHLY_CENTS"]) process.env[name] = "10";
  process.env.AI_ENABLED = "true"; process.env.AI_PRICING_VERIFIED = "true";
  global.fetch = async (input) => {
    assert.ok(String(input).includes("security_reserve_ai")); return Response.json({ allowed: false });
  };
  try {
    await assert.rejects(async () => { await reserveAi("key", "00000000-0000-0000-0000-000000000001", "qr"); calls++; }, /usage limit/);
    assert.equal(calls, 0);
  } finally { global.fetch = saved; process.env.AI_ENABLED = "false"; }
});
test("unknown QR lookups consume quota first; quota outages stop before data access", async () => {
  const { GET } = await import("../../app/r/[slug]/route");
  const saved = global.fetch; const operations: string[] = [];
  global.fetch = async input => {
    const path = new URL(String(input)).pathname; operations.push(path);
    if (path.endsWith("security_consume_rate")) return Response.json({allowed:true});
    if (path.endsWith("qr_codes")) return Response.json([]);
    throw new Error("Unexpected QR fixture call");
  };
  const req = new NextRequest("https://app.example/r/unknown-fixture");
  try {
    assert.equal((await GET(req,{params:Promise.resolve({slug:"unknown-fixture"})})).status,404);
    assert.ok(operations[0].endsWith("security_consume_rate"));
    operations.length = 0;
    global.fetch = async input => { operations.push(new URL(String(input)).pathname); return new Response("",{status:503}); };
    assert.equal((await GET(req,{params:Promise.resolve({slug:"unknown-fixture"})})).status,503);
    assert.ok(operations.every(path=>path.endsWith("security_consume_rate")));
  } finally { global.fetch = saved; }
});
test("QR previews do not count visits; analytics failure does not break a safe destination", async () => {
  const { GET, HEAD } = await import("../../app/r/[slug]/route");
  const saved=global.fetch; let visits=0;
  global.fetch = async input => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("security_consume_rate")) return Response.json({allowed:true});
    if (path.endsWith("qr_codes")) return Response.json([{id:"fixture-qr",business_id:"fixture-business",active:true}]);
    if (path.endsWith("businesses")) return Response.json([{google_review_url:"https://g.page/r/valid_fixture/review"}]);
    if (path.endsWith("security_record_visit")) { visits++; return Response.json({message:"analytics fixture unavailable"},{status:503}); }
    throw new Error("Unexpected QR fixture call");
  };
  const context={params:Promise.resolve({slug:"valid-fixture"})};
  try {
    const head = await HEAD(new NextRequest("https://app.example/r/valid-fixture",{method:"HEAD"}),context);
    assert.equal(head.status,302); assert.equal(visits,0);
    assert.equal((await GET(new NextRequest("https://app.example/r/valid-fixture",{headers:{"user-agent":"WhatsApp Preview"}}),context)).status,302);
    assert.equal(visits,0);
    const response=await GET(new NextRequest("https://app.example/r/valid-fixture"),context);
    assert.equal(response.status,302); assert.equal(response.headers.get("location"),"https://g.page/r/valid_fixture/review"); assert.equal(visits,1);
    assert.match(response.headers.get("cache-control")!,/no-store/);
  } finally {global.fetch=saved;}
});
