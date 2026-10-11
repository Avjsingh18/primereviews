# Production domain

Updated 11 October 2026.

- **Production address:** `https://primereviews.in` (registered at GoDaddy; DNS points to Vercel).
- `https://www.primereviews.in` redirects permanently (308) to `https://primereviews.in`.
- `https://reviewflow-seven-omega.vercel.app` is the old address. It still serves the app, and `/r/<slug>` redirects on it keep working, so QR codes printed before the move are not broken. Do not delete the Vercel project or this alias while old cards may be in use.

## What depends on the domain

- `NEXT_PUBLIC_SITE_URL` (Vercel, Production) must be `https://primereviews.in`. It sets the address encoded in new QR codes (`<site>/r/<slug>`) and is the only origin the same-origin check accepts. Sign-in and other POST requests from any other address, including the old `vercel.app` one, are refused with "This request is not allowed."
- Supabase → Authentication → URL Configuration: Site URL `https://primereviews.in`; Redirect URLs include `https://primereviews.in/reset-password`.
- `app/sitemap.ts`, `app/robots.ts` and the page metadata use `primereviews.in`.

## Search Console

`primereviews.in` is verified as a Domain property (DNS record added by Google at GoDaddy; do not delete it). Sitemap `https://primereviews.in/sitemap.xml` was accepted (8 pages) and the home page was submitted for indexing on 11 October 2026. The domain had a previous owner; Manual actions and Security issues both report no issues.

## Renewal

The first year cost ₹99. It renews in October 2027 at ₹899. Keep auto-renew on: if the domain lapses, every printed QR code stops working.

Older documents in this folder that mention the `vercel.app` address describe the setup at the time they were written.
