# ReviewFlow / PrimeReviews security and abuse audit

Date: 2026-10-08. Scope: source, deployed production application, Supabase security metadata, and publicly reachable older deployments. This is a targeted security review, not a penetration-test certification.

## Executive assessment

The most important confirmed weakness is that the application rate limiter is not atomic. Its account limits also include the client's IP address, so they are not true account limits. These weaknesses affect authentication abuse today and would weaken paid AI feature protection after an OpenAI key is enabled.

No public tenant-data leak was demonstrated. Current unauthenticated business and analytics requests return 401, and the live public database tables have RLS enabled with direct anonymous/authenticated table privileges revoked. These are useful protections, but do not solve resource-exhaustion attacks through the application.

Do not enable paid AI generation for unrestricted public usage until atomic quotas, account-level limits independent of IP, and hard application spending/concurrency controls are implemented. Also close the public access paths to superseded deployments.

## Versions and verification boundaries

- Production: `https://reviewflow-seven-omega.vercel.app`; Vercel production deployment `dpl_5NfeMUShEv79UZavCWrhF1PYfbYm`, serving `main` commit `9324e733aeaf70a717566ace1b4ee602c5b904d7`.
- Local source: branch `local`, commit `347d9c04fe47bf85e8c095d70ba031c7d9bd96c4`. Shared production code was checked against `main`; local adapter differences are listed separately below.
- Supabase: project `oeskvrckfzuqxpeczxcl`, healthy at inspection.
- Live checks were small, unauthenticated, and non-destructive. No brute force, load test, new account, real QR scan, paid model call, cloud configuration change, or tenant-data mutation was performed.
- The rate-limit concurrency test used the actual limiter implementation with mocked network responses, not the production database.
- No authenticated two-tenant access test or stolen-session replay was performed. Those remain necessary before asserting comprehensive tenant/session security.
- Custom Vercel firewall configuration could not be verified: metadata queries returned 404, `Seawall Config not found`. This does not prove Vercel's built-in DDoS protection is absent.

## High-priority findings

### H1. Parallel requests bypass the rate limiter — High, reproduced

Evidence: `lib/rate-limit.ts:35-48` separately reads the counter, decides, then writes `count + 1`. The operations are not a transaction or atomic increment. Multiple requests can all observe the same value and overwrite each other's updates. Creation/window reset has a similar race. The update also does not verify that a row was actually updated.

Safe reproduction: a bucket with `request_count = 2`, limit 3, received 12 concurrent calls. All 12 were allowed; the stored counter ended at 3. Expected: only one allowed call.

Impact: parallel login/signup attempts and parallel expensive AI requests can exceed the intended quotas. Exact upstream throughput still depends on provider limits and server capacity; this is not a claim that all external protections can be bypassed.

Fix: implement an atomic Postgres quota operation through a narrowly granted RPC/transaction, or an atomic shared-counter service. Check and increment in the same operation, including creation and window reset. Test contention, expiration, failure, and retries. A normal Supabase `select()` followed by `update()` is insufficient.

### H2. Account quotas reset when an attacker changes IP — High, confirmed design defect

Evidence: `lib/rate-limit.ts:18-19` hashes `scope:identity:clientIP` for every scope. That includes supposed user/email limits. Offline testing confirmed that the same account/email receives different bucket keys on different IPs.

Declared production limits, before accounting for this defect and H1:

| Action | Account/email-plus-IP bucket | Separate IP bucket |
| --- | --- | --- |
| Login | 8 / 15 minutes | 30 / 15 minutes |
| Signup | 3 / hour | 10 / hour |
| Change password | 5 / 15 minutes | None in that handler |
| AI QR design | 3 / hour | 10 / hour |
| Nearby competitor search | 10 / hour | 30 / hour |

Impact: an automated client with proxy/IP rotation can keep using the same account while obtaining fresh account buckets. Bot-created accounts add another multiplier. Email confirmation alone is not strong abuse resistance.

Fix: keep independent account-ID, IP, tenant, and global quotas. An account limit must not include IP. Add risk-based challenges to public authentication flows, without assuming CAPTCHA replaces quotas.

Production IP-header spoofing was not demonstrated. Vercel documents that it overwrites `x-forwarded-for` and supplies the same client IP in `x-real-ip`. Genuine IP rotation is sufficient for this defect. Other hosting/proxy setups need their own trusted-proxy rules. [Vercel request headers](https://vercel.com/docs/headers/request-headers)

### H3. Superseded deployments remain public alternate attack paths — High

Evidence: older production deployment hosts for commits `dd67e70` and `e67794b` still responded directly to `/api/auth/login` with the old handler's 400 validation response, not a deployment-protection challenge. Those commits lack the newer application authentication rate limits. Their sampled responses also lacked the current CSP.

Observed hosts:

- `reviewflow-43dze7yty-reviewflow4.vercel.app`
- `reviewflow-ptn0vgy20-reviewflow4.vercel.app`

Impact: changing the production alias does not retire older callable code. An attacker can target an old endpoint rather than the newer guarded one. Actual credential attempts were not made, and Supabase's own authentication limits can still apply. Old environment values and full authenticated behavior were not inspected.

Fix: remove or protect superseded deployment URLs and branch aliases. Keep the intended production domain public while protecting previews and old builds. Audit old environment snapshots and rotate secrets if an actual exposure is found; public reachability alone is not proof of secret leakage.

### H4. Database-backed endpoints can be flooded before effective protection — High availability risk

Evidence:

- `app/r/[slug]/route.ts:13-20` looks up the QR and business before checking any quota. Unknown slugs return 404 without consuming an application quota at all.
- `lib/rate-limit.ts` itself requires database reads and writes. Over-limit valid requests still cause database work.
- Business and analytics handlers lack application quotas. Authentication checks also call Supabase before any general request limiter.
- `app/api/analytics/scans/route.ts:3` retrieves scan timestamps and aggregates them in JavaScript, without a bounded time range or pagination. Other analytics handlers retrieve snapshot history similarly.

Attack scenario: a bot repeatedly requests random `/r/<slug>` values, producing database lookups without hitting the QR limiter. An authenticated abusive client can repeatedly request expensive analytics. This was identified from code, not demonstrated through load testing.

Impact: exhausted function concurrency, database connections/CPU, bandwidth, or hosting quotas. A rate limiter that uses the same stressed database is not sufficient as the first defense.

Fix: add edge-level abuse controls before database access; apply separate IP/global limits to unknown QR requests and authenticated APIs; aggregate scans in SQL within validated date ranges; paginate history; cap payload sizes; monitor saturation. Keep security counters shared across instances.

### H5. Paid AI features lack an enforceable application-wide spending ceiling — High when enabled

Evidence: `app/api/qr-design/route.ts` and `app/api/benchmark/route.ts` rely on the defective quotas above. They do not reserve tenant/global spending credits before calling the provider. In-memory `pending`/`inFlight` maps only coalesce work inside one server instance; they are not distributed concurrency controls.

`lib/competitor-discovery.ts:94-97` calls the Responses API with web search but no explicit output-token or tool-call cap. Cache keys change with theme, category, radius, requested result count, or business coordinates, allowing requests to create fresh cache misses. Timeouts limit waiting, not a guaranteed dollar budget.

The current nearby-search implementation uses OpenAI web search, not a direct Google Places request. Its abuse/cost controls must cover that actual provider.

Current exposure: production `/api/qr-design` returned 503 saying `OPENAI_API_KEY` is not configured. No paid generation was performed. The spending risk is conditional on enabling the feature, not evidence of an existing unexpected bill.

Fix: atomically reserve a conservative charge/credit amount before each paid request; enforce per-user, per-tenant daily/monthly, and global hard ceilings; reconcile actual usage; stop requests when reservations are exhausted. Add explicit supported output/tool limits, distributed concurrency limits, model allowlists, and an emergency kill switch. Failed caching must not automatically trigger paid retries. Keep cached retrieval separate from new-generation credit consumption.

### H6. AI cache and abuse counters can accumulate indefinitely — High capacity risk when AI is enabled

Evidence: `lib/supabase-cache.ts:5-18` deletes an expired entry only when that exact key is requested again. Unique expired keys are never swept. `lib/qr-design.ts:77-80` returns a base64 image, and the whole design is stored in `reviewflow_cache`. Rate-limit buckets have no cleanup path in the inspected application. No database cron extension/job was found in the queried live metadata.

Impact: unique themes create large image JSON rows; changing identities/IPs creates new quota rows. “Expires tomorrow” is not the same as “deleted tomorrow.” Growth can consume database/storage quotas and worsen the availability problem.

Current baseline: the cache had zero rows at inspection. This is a forward-looking capacity issue, not a claim the database is already full.

Fix: store artwork in object storage; keep bounded metadata in Postgres; run scheduled deletion of expired cache/bucket records; cap per-tenant artifacts and total retention; monitor table/storage growth.

## Additional findings

### M1. Logout clears the browser cookie but does not revoke the provider session — Medium

`app/api/auth/logout/route.ts:3-6` only expires `prime_reviews_session`. It does not invoke provider sign-out or invalidate a session record. A previously copied access token is not revoked by deleting a cookie. Login stores an access token in a one-hour cookie; the server clients disable token refresh, and there is no refresh-cookie lifecycle.

Fix: use a complete server-side session integration with refresh handling and provider sign-out. If immediate invalidation of a stolen access token is required, enforce active-session/revocation checks. Supabase states that access JWTs can remain valid until expiration even after normal sign-out. Password-change session invalidation also needs an explicit test/policy. [Supabase sign-out semantics](https://supabase.com/docs/guides/auth/signout)

### M2. Service-role access makes route-level ownership checks security-critical — Medium architectural risk

`lib/api.ts:11-14` returns a service-role client after validating the user's token. That client bypasses RLS. Current reviewed business/analytics handlers apply explicit ownership filters; no IDOR was demonstrated. However, a future omitted filter would not be stopped by the table's RLS policy.

Fix: use user-scoped clients and RLS for ordinary tenant operations; reserve admin access for narrow internal operations. Add two-tenant negative tests for every read/write endpoint and every new API.

### M3. QR destination validation is broader than “Google review page” — Medium trust/integrity risk

`lib/api.ts:25-30` accepts any HTTPS URL on approved Google hosts, regardless of path. The actual validator accepted a Google outbound `/url?q=...` URL in an offline check. Google may interpose a warning; an external final destination was not demonstrated live. Older code also had a broader URL check. `app/r/[slug]/route.ts:27` trusts the stored destination without revalidation, and the database constraint only requires an HTTP(S) prefix.

Fix: accept supported review/maps URL formats, reject outbound redirect endpoints, and validate legacy stored destinations. If resolving short URLs, constrain every redirect hop, destination host, timeout, and response size; do not introduce unrestricted server-side URL fetching. This finding is not a demonstrated SSRF vulnerability.

### M4. AI “verified” competitor labels are not independent verification — Medium integrity risk

`lib/competitor-discovery.ts:109-111` considers a model-provided rating/count verified if its URL appears among citations and is on a Google host. That does not prove the cited page supports the exact business and numbers. Coordinates provided by the model are considered distance-verified merely because they exist and pass numeric checks.

Impact: hallucinated values or poisoned search-source content can become confident-looking rankings, cached for other requests. Indirect prompt injection is a relevant threat for web search; no application-tool execution or secret-exfiltration path was demonstrated here.

Fix: distinguish “AI-found, cited” from independently verified data; use authoritative structured sources when available; independently resolve business identity/coordinates; retain provenance/timestamps and handle unsupported values as unknown. Prompts saying “do not invent” are not a security boundary.

### M5. QR counts are easily manipulated and the limiter can block real customers — Medium

The public QR endpoint records a GET, not a verified human scan or completed Google review. Rotating IPs can inflate scans. Link previews/crawlers can count as scans. The one-record-per-IP/slug per five minutes rule suppresses legitimate customers behind shared Wi-Fi/NAT, while the 30 requests/minute rule can block their redirects. Both limiter failures return 503 instead of reaching Google.

Fix: label metrics as redirect visits, filter known previews/bots, separate total and deduplicated visits, and do not claim reviews/conversions from scan counts. Design QR availability so analytics failures do not unnecessarily break legitimate redirects, while edge controls handle abusive traffic. Unsalted IPv4 hashes should not be described as irreversible anonymization; use appropriate pseudonymization and retention.

### M6. Authentication hardening and input handling gaps — Medium/Low

- The live Supabase security advisor reports leaked-password protection disabled. Supabase documents this feature as Pro-plan-and-above; assess the plan or an alternative control. It is not evidence that stored passwords are plaintext. [Password security](https://supabase.com/docs/guides/auth/password-security)
- No CAPTCHA/challenge token is wired into the inspected application. Actual provider CAPTCHA configuration was not verified. Supabase-native limits still exist and should complement application controls. [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- Login/signup lack explicit maximum lengths for several fields. Benchmark's validator dereferences JSON `null` and uses `in` on the category object. A live unauthenticated `null` benchmark request produced 500; it should return a controlled 400 before backend work.
- There is no explicit Origin check/content-type enforcement in the reviewed cookie-mutating authentication handlers. SameSite=Lax mitigates many authenticated CSRF scenarios, but does not by itself establish login-CSRF protection. Cross-origin exploitation was not demonstrated. Test and enforce same-origin writes rather than claiming a confirmed account takeover.
- Signup maps an email-send-rate-limit error to a confirmation-required success response. This can tell users to expect an email that the provider refused to send. Fix truthful status handling and resend cooldown behavior.

### M7. Browser/cache policy defense gaps — Medium/Low

- Sampled API responses, including 401s, had `Cache-Control: public, max-age=0, must-revalidate`. They were cache misses; no cross-user cache leak was demonstrated. Sensitive authenticated responses should explicitly be `private, no-store`.
- CSP permits inline scripts. This weakens defense if an injection bug is introduced; no exploitable XSS was found in the inspected paths. Move toward a nonce/hash policy compatible with the framework.
- `Permissions-Policy: geolocation=()` blocks the intended browser location feature. This is a confirmed functional policy contradiction, not a data-exfiltration finding. Permit only the needed origin and keep user consent.
- `.gitignore` covers the common `.env`/`.env.local` patterns, but not every environment variant or `.vercel` directory. No tracked key exposure was found in the limited pattern/history checks. Broaden ignores and add a real secret scanner to CI.

## Local-only risks and regression

These are separate from production. They must not be promoted as production connectivity code.

1. `scripts/local-dev.sh:29-35` initializes passwordless trust authentication and supplies a known default JWT signing secret. Postgres is bound to loopback; the Spring command does not explicitly bind its server to loopback. Actual network exposure was not tested. If reachable outside the developer machine, known signing secrets can allow token forgery. Require localhost-only binding and non-default secrets outside deliberately isolated local development.
2. With `REVIEWFLOW_LOCAL_BACKEND=true`, AI routes skip the production quotas but still use `supabase-cache.ts`. Local mode therefore does not guarantee all database accesses stay local. If cloud credentials remain in the process environment, AI cache operations can target the cloud database. Do not enable paid keys/shared cloud resources under this assumption; isolate the cache adapter too.
3. The merged dashboard, settings, and onboarding requests omit the bearer token expected by the local Spring rewrites. This is a source-confirmed connectivity regression, not a production tenant breach. The previous successful build did not establish local end-to-end auth correctness. Fix/test the auth adapter before relying on this branch as a working isolated local environment.

## Controls that were confirmed working

- All six live public tables have RLS enabled: `businesses`, `qr_codes`, `qr_scans`, `review_snapshots`, `reviewflow_cache`, `rate_limit_buckets`.
- Queried public table privileges are granted to `service_role`, not direct anonymous/authenticated roles. Ownership/deny policies are present. No public SECURITY DEFINER function was found in the inspected catalog.
- Business/QR identity uniqueness and foreign-key constraints exist; rating/count constraints exist. The database's broad URL constraint remains a gap described above.
- Current unauthenticated business/analytics/QR APIs return 401. Public dashboard/reviews HTML includes application shell/demo content; its reachability alone is not evidence of private tenant-data leakage.
- Production session cookie is HttpOnly, Secure, SameSite=Lax.
- Live HTTPS responses provide HSTS, anti-framing, MIME-sniffing, and referrer protections.
- `/.env` and `/.git/config` returned 404 on the public production site.
- `npm audit --omit=dev --json` reported zero known production dependency advisories at inspection. This does not prove dependency or application code is vulnerability-free.

## AI-agent attack model and recommended implementation order

An AI agent does not need a special exploit: it can call HTTP endpoints directly, run concurrent requests, vary prompts to miss caches, rotate real IPs/accounts, and operate while nobody is watching. Browser button cooldowns and process-local maps do not constrain that client.

1. **Before paid AI:** repair atomic quotas; split account/IP quotas; reserve hard global/tenant credits; cap concurrent/provider work; add a kill switch.
2. **Before broader public growth:** retire/protect old deployments; deploy edge abuse rules; bound unauthenticated QR lookups and authenticated API workloads; handle malformed requests safely.
3. **Database resilience:** SQL time-window aggregates, pagination, cache/object-storage separation, TTL sweeping, retention/storage quotas, and operational alerts.
4. **Account/tenant controls:** complete session lifecycle and revocation policy, appropriate challenges/password protections, user-scoped data clients, and automated cross-tenant tests.
5. **Integrity/privacy:** reliable destination validation, truthful competitor verification/scan labels, provenance, and location/IP retention policies. Business coordinates are sent to the AI provider for discovery; privacy wording must reflect that processing.
6. **Regression gates:** parallel quota tests, rotated-IP same-user tests, budget-exhausted tests proving zero provider calls, old-deployment reachability checks, logout/session tests, cache eviction tests, and two-user read/write isolation tests.

Use Vercel edge controls as a first layer, not the only layer. Use application authorization, atomic quotas, and spending reservations as the authoritative business controls. [Vercel WAF documentation](https://vercel.com/docs/vercel-firewall/vercel-waf)

## Work performed

This audit changed no application code, database data, cloud settings, secrets, or deployment. Only this report was added locally. Findings marked conditional or unverified require the stated follow-up tests; absence of a demonstrated exploit is not a blanket security guarantee.
