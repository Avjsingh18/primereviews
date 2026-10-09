# ReviewFlow security hardening and release gate

Date: 2026-10-09. Status: implemented and tested locally; **not deployed**.

## Scope and branch safety

Work is on `local`, based on `347d9c04fe47bf85e8c095d70ba031c7d9bd96c4`. `main` remains at `9324e733aeaf70a717566ace1b4ee602c5b904d7`. No push, merge, hosted migration, cloud-setting change or production-data mutation was performed in this hardening phase. The earlier audit is preserved in `security-audit-2026-10-08.md`.

This is an application-code hardening pass with regression tests, not a certification that no vulnerabilities exist. Production still serves the older code until an explicitly approved release. Tests use synthetic accounts, disposable local databases and mocked provider responses, not paid OpenAI calls or production attack traffic.

## Finding disposition

| Earlier finding | Local remediation | Remaining release work |
| --- | --- | --- |
| H1: concurrent quota bypass | Atomic Postgres quota RPC, contention tests, fail-closed outages | Apply migration and verify hosted RPC behavior |
| H2: IP rotation resets account quota | Separate account/email, IP and global buckets; HMAC keys | Verify trusted ingress headers and edge rules |
| H3: public old deployments | Cannot fix through application source | Protect/remove old builds and aliases before release |
| H4: resource exhaustion | Quotas before unknown QR lookup; bounded JSON/body deadlines; bounded SQL analytics; capacity ceilings | Edge controls must reject floods before database/function work |
| H5: uncontrolled paid AI | Default-off switch; atomic conservative cost reservations; distributed concurrency; token/tool/image caps | Review real model pricing/availability and billing safeguards before enabling |
| H6: unbounded stored artifacts | Private object storage, bounded metadata, caps, scheduled cleanup | Verify hosted Storage, cron and orphan deletion |
| M1: copied sessions survive logout | Opaque server sessions, encrypted provider tokens, revocation, refresh leases, password-change epoch | Roll out without old public API paths; verify hosted provider behavior |
| M2: tenant operations bypass RLS | User-scoped clients, ownership RLS, narrow service-only RPCs; two-tenant negative tests | Apply and verify live grants/policies |
| M3: unsafe QR destination | Strict supported Google HTTPS formats; runtime revalidation; new-write DB constraint | Review legacy values and validate the NOT VALID constraint |
| M4: inaccurate AI verification claims | AI-reported/cited values labeled as needing verification; coordinates not independently verified | Authoritative structured data is still future work |
| M5: misleading/inflatable scan counts | Label as redirect visits, omit known previews/HEAD, no new IP/UA retention; analytics failure preserves valid redirects | Visits are not unique humans, completed reviews or fraud-proof counts |
| M6: auth/input gaps | Same-origin JSON writes; bounded input; breached-password check; truthful email errors | CAPTCHA is deliberately deferred; native Supabase password protection/change safeguards must be verified |
| M7: browser/cache/secrets | Nonce CSP, no-store private responses, restricted browser policy, secret/history/build scans, ignores | Verify real deployed headers and environment exposure |
| Local adapter issues | Loopback-only services, local DB sessions, revocation, SQL aggregates, strict URLs; cloud/paid integrations disabled | Keep local connectivity out of production release |

## Additional direct-API bypass closed

A Supabase tenant JWT obtained outside this app must not allow unrestricted direct Data API requests that bypass our application quotas. The migration adds restrictive policies requiring a server-only proof **as well as** normal tenant ownership. User-scoped clients attach `x-reviewflow-server-proof` only on the server. The private guard stores only SHA-256 of the independently generated `DATABASE_API_SECRET`.

The sole SECURITY DEFINER helper is read-only, has an empty search path, uses fully qualified objects and returns only a boolean. Clients cannot read the guard table or configure it. Tests verify that missing/forged proof denies direct tenant reads, while correct proof still cannot cross tenants. This does not replace service-key secrecy or native Auth abuse controls.

## Important limits and behavior

- Global public request bucket: 1,500/minute; separate ingress IP bucket: 120/minute. Shared counters fail closed and have a 20,000-key capacity ceiling. Each rejected application request can still incur DB work; this is why edge controls are required.
- General authenticated read/write limits: 120/30 per minute; additional auth and AI action limits apply. Account identity does not include the IP.
- Request JSON: 8 KB maximum with a five-second read deadline. Provider fetches are bounded and do not follow arbitrary HTTP redirects.
- Analytics: strict calendar dates, no future ranges, at most 365 days between endpoints; SQL daily aggregates rather than downloading raw scan history.
- Cloud app sessions: opaque cookies, hashed DB identifiers, encrypted provider tokens, HttpOnly/SameSite=Lax, production Secure `__Host-` cookie; five sessions per user and 10,000 globally. Password changes invalidate app sessions and reject in-flight pre-change logins.
- AI: one active request per user, three globally; atomic user/global daily/monthly cost reservations. Failed or ambiguous provider work does not refund reserved costs. Reservations require a conservatively reviewed per-call maximum; they cannot guarantee a provider's billing behavior if pricing assumptions are wrong.
- Cache: metadata at most 64 KB, 2,000 rows globally/30 per owner; TTL 60 seconds–24 hours. AI job history and QR job counts are also capped.
- Artwork: private WebP objects at most 2 MB; five-minute signed URLs. AI generates a background, not the encoded QR modules; the QR overlay remains deterministic.
- Maintenance: authenticated cron route, bounded expired-object batches and orphan sweep; raw historical scans retained up to 90 days and daily totals up to 730 days, subject to scheduled cleanup catching up.
- Local mode: loopback PostgreSQL and Spring only, opaque local sessions, no cloud database or paid AI access. Local passwordless loopback PostgreSQL is for a trusted workstation, not shared hosting.

## Verification evidence

| Check | Result | Boundary |
| --- | --- | --- |
| Next production build and TypeScript | Passed | Local build, not deployment |
| Security unit suite | 21 passed in test mode; same 21 passed in production mode | Mocked provider/network behavior where appropriate |
| PostgreSQL security suite | 17 groups passed | All SQL migrations in order on disposable PostgreSQL 16; simulated Auth/Storage schemas |
| Local backend HTTP/database flow | 8 groups passed | Real Spring/PG fixture, two users, auth, QR persistence, URL updates, logout and password revocation |
| Production-mode HTTP suite | 12 groups passed | Built app on loopback with fake cloud credentials; nonce scripts, private cache, CSRF, malformed bodies, disabled AI and cron auth |
| Java unit tests | 3 passed | Local Gradle test results |
| Dependency checks | npm audit: zero known advisories; OSV: zero across 89 Java runtime artifacts | Known advisory snapshots, not proof of vulnerability-free dependencies |
| Secret scanning | No recognized source/history/static-bundle secrets found | Pattern checks and comparison with configured private environment values, not forensic proof that no secret has ever leaked |
| Browser smoke flow | Passed login → onboarding → QR → dashboard → settings → logout | Local synthetic fixture; browser logs had no warnings/errors; fixture rows removed |
| Production env guard | Missing configuration rejected | Shape check only; does not inspect hosted WAF or migrations |

The suites cover concurrent quota exhaustion, IP-independent identity, tenant write/read denial, direct Data API denial, privileged-table/RPC denial, refresh contention, logout replay, password epoch races, capacity/TTL controls, unsafe URLs, AI budget denial before provider invocation and controlled provider failure. No brute-force, production load test, real provider image generation or Google OAuth publishing was performed.

Local commands: `npm run test:security`, `npm run test:security:production`, `npm run test:security:db`, `npm run test:security:local`, `npm run test:security:http`, `npm run check:secrets`, `npm run typecheck`, `npm run build`; Java uses `gradle test bootJar` and `node scripts/check-java-dependencies.mjs`. HTTP tests only accept a loopback fixture. DB tests create/drop their own uniquely named disposable databases, not existing application databases.

The new GitHub workflow uses read-only permissions and immutable action SHAs. Its commands were verified locally; the workflow itself has not run on GitHub because nothing was pushed.

## Mandatory release gates — not completed in this phase

1. **Review the release diff.** Promote shared hardening only. Do not promote local Spring connectivity, workstation DB state, `.env` files, `.local`, demo assets or private keys. Retain a backup/rollback plan compatible with the new schema; do not roll back to publicly callable insecure handlers.
2. **Back up hosted data and apply the migration** `supabase/migrations/20261009000000_security_hardening.sql`. Verify tenant grants, service-only RPCs, capacity tables and the private artwork bucket. Review old stored URLs/caches; clean or repair only approved exact targets. Validate the legacy URL constraint after review.
3. **Provision independent server secrets securely.** `SESSION_ENCRYPTION_KEY` and `DATABASE_API_SECRET` must each be independently generated 32-byte hex keys. `RATE_LIMIT_SECRET` and `CRON_SECRET` must be independent high-entropy values of at least 32 characters. Never prefix these with `NEXT_PUBLIC_`, commit them or paste actual values into a report.
4. **Configure the Data API guard** using the service-only `security_configure_data_api(p_hash)` RPC with SHA-256 of the exact `DATABASE_API_SECRET` value. Store the raw proof only in the server environment and the hash in the private DB guard. Verify an app request succeeds and a native tenant JWT without proof fails. Changing only the environment key without updating the guard intentionally blocks tenant access.
5. **Defer native CAPTCHA until it is configured end to end.** The Turnstile implementation is intentionally removed from this release. Do not enable Supabase CAPTCHA until a future release contains and verifies the matching browser-token flow. Configure exact Site URL/email redirect allowlists; never use broad production wildcard redirects.
6. **Verify provider-native password safeguards.** App-side HIBP rejects known breached passwords but can be bypassed by clients calling native GoTrue directly. Enable native leaked-password protection/secure password-change controls or implement a separately reviewed supported provider hook/control. This gate is not solved merely by adding the app's password check; assess provider plan/access and test the actual configuration.
7. **Protect/remove superseded deployments and branch aliases.** The earlier audit found alternate public old handlers. Verify those paths are no longer callable before broad public release. Inspect old environment snapshots and rotate credentials if exposure is established; reachability alone does not prove a key leak.
8. **Configure ingress abuse controls before DB work.** Vercel WAF/appropriate edge limits and bot/challenge rules must cover authentication, unknown QR URLs, analytics and expensive AI routes, including distributed IP/account abuse. Assess plan capabilities; set alerts for requests, function concurrency, DB saturation and storage growth. Application DB counters alone cannot absorb arbitrary internet floods.
9. **Verify session rollout.** Retire legacy bearer-token APIs/deployments, invalidate legacy sessions as appropriate, and test hosted refresh, copied-cookie logout denial, password-change revocation and two real test tenants. Do not expose provider access/refresh tokens to browser scripts.
10. **Verify hosted Storage and maintenance.** Test short-lived signed artwork, CORS/canvas downloads, object access denial, expiration/orphan cleanup, cron authentication and daily scheduling. These external behaviors were not validated against real hosted Storage.
11. **Keep `AI_ENABLED=false` for initial release.** Only enable after reviewing actual available models, worst-case token/tool/image prices, six positive cost-cap variables, billing safeguards and an emergency off procedure. `AI_PRICING_VERIFIED=true` is an acknowledgement, not a price lookup. Provider budget alerts are not a guaranteed hard spending stop. Use a bounded paid smoke test only with explicit approval.
12. **Deploy only after approval and repeat hosted checks.** Verify the exact public URL, production cookies/CSP/cache headers, native Auth direct-access controls, tenant isolation, redirect destinations, old-deployment retirement and monitoring. Local passing tests do not automatically establish that live provider settings match them.

Until these gates are verified, the application must not be described as fully security-cleared or deployment-ready. No absolute guarantee against attackers is possible; the concrete identified code defects have been addressed, and unresolved hosted/operational controls are explicitly recorded here.
