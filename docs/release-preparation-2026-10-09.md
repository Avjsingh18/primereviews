# Selective main merge and deployment readiness

The user authorized merging shared local changes into main and deploying on 2026-10-09. The shared application hardening was selectively merged in an isolated main checkout so the running local branch and its database remain intact.

## Exclusions

- No changes to main's existing `backend/` directory were promoted. New local Flyway migrations and the Spring auth/session adapter stay on `local`.
- Local startup/status scripts, local end-to-end adapter script and Java dependency-check script were excluded.
- Main has no localhost API rewrites or local database startup commands. Its login/signup/settings always use the hosted authentication path, not the local CAPTCHA bypass.
- The new main CI workflow checks only shared application/security behavior. The local adapter CI job remains on `local`.
- Private `.env` files, `.local` data, Supabase CLI temporary state and demo directories were not staged. Ignore rules are defense-in-depth, not credentials.
- The harmless local-mode rejection checks remain: setting a local flag must fail a release rather than switch production to a local database.

## Hosted inspection — release blocked

Verified Vercel project: `reviewflow`, team `reviewflow4`, production domain `reviewflow-seven-omega.vercel.app`. Its configured variables at inspection are only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; no hidden production variables were reported.

> **Update (11 October 2026):** production now runs on `https://primereviews.in`. See `docs/production-domain.md`. The address above is the one that was verified when this was written.

The release still needs the canonical public site URL, independent session/rate/Data-API/cron secrets and Turnstile configuration. Native Supabase CAPTCHA must be configured and verified before setting the acknowledgement flag. Creating a real Turnstile site/account and entering its secret in Supabase requires the account owner; do not use public test keys or disable the challenge to make the release pass.

Supabase `oeskvrckfzuqxpeczxcl` is healthy but does not yet have `app_sessions`, the atomic quota RPC or the Data API guard. Its advisor still reports native leaked-password protection disabled. Applying the migration without coordinated release setup is not a substitute for finishing authentication configuration.

The Vercel firewall metadata endpoint returned `Seawall Config not found`; custom ingress rules remain unverified. This does not prove built-in Vercel DDoS protection is absent.

No hosted schema/settings changes, GitHub push or production deployment were made during this preparation. Pushing main would automatically start a production build; that push is intentionally held until dependencies are ready rather than publishing broken login/signup or weakening the build guard.

Complete the mandatory hosted release gates in `security-hardening-2026-10-09.md`, then push the tested main commit, stage the production build, test it and promote it. Keep AI off until spending/pricing configuration is reviewed.
