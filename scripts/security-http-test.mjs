import assert from "node:assert/strict";

// Only point this test at our loopback production-mode fixture, never a live site.
const base = process.env.SECURITY_HTTP_URL || "http://127.0.0.1:3100";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error("Security HTTP fixture must be loopback");
let checks = 0;
const pass = message => { console.log(`PASS ${message}`); checks++; };
let previousNonce;
for (const path of ["/login", "/signup"]) {
  const response = await fetch(base + path, { headers: { "x-nonce": "attacker-chosen-nonce" }, redirect:"manual" });
  assert.equal(response.status, 200, path);
  const csp = response.headers.get("content-security-policy");
  assert.ok(csp, path);
  const scriptPolicy = csp.split(";").find(x => x.trim().startsWith("script-src"));
  assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval|attacker-chosen/);
  assert.match(scriptPolicy, /strict-dynamic/);
  const nonce = scriptPolicy.match(/'nonce-([^']+)'/)[1];
  assert.notEqual(nonce, previousNonce); previousNonce = nonce;
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  const html = await response.text();
  const scripts = html.match(/<script\b[^>]*>/g) || [];
  assert.ok(scripts.length);
  for (const script of scripts) assert.ok(script.includes(`nonce="${nonce}"`), `${path}: executable script lacks matching nonce`);
  assert.doesNotMatch(html, /fixture-service-placeholder|SUPABASE_SERVICE_ROLE_KEY/);
  pass(`${path}: fresh server nonce on every script, no-store, framing and MIME protections`);
}
for (const path of ["/dashboard", "/qr-code", "/benchmark", "/settings"]) {
  const response = await fetch(base + path, { redirect: "manual" });
  assert.equal(response.status, 307, path);
  const redirect = new URL(response.headers.get("location"), base);
  assert.equal(redirect.pathname, "/login", path);
  assert.equal(redirect.searchParams.get("next"), path, path);
  assert.match(response.headers.get("cache-control"), /no-store/);
  pass(`${path}: unsigned visitor is redirected to login without rendering product content`);
}
for (const [path, headers, body, expected] of [
  ["/api/auth/login", {origin:"https://evil.example","content-type":"application/json"}, "{}", 403],
  ["/api/auth/logout", {origin:"https://app.example","content-type":"text/plain"}, "{}", 415],
  ["/api/auth/register", {origin:"https://app.example","content-type":"application/json"}, "null", 400],
  ["/api/auth/login", {origin:"https://app.example","content-type":"application/json"}, JSON.stringify({text:"x".repeat(9000)}), 413],
  ["/api/qr-design", {origin:"https://app.example","content-type":"application/json"}, "{}", 503],
  ["/api/internal/maintenance", {}, undefined, 401],
]) {
  const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers, ...(body === undefined ? {} : {body}) });
  assert.equal(response.status, expected, path);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.doesNotMatch(await response.text(), /fixture-service-placeholder|stack|SUPABASE_SERVICE_ROLE_KEY/);
  pass(`${path}: controlled ${expected}, private/no-store, no provider details`);
}
console.log(`${checks} production-mode HTTP groups passed; no hosted account or paid provider used.`);
