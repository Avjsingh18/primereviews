# Landing page redesign — working brief

Goal: replace the outdated public landing page with an accurate, futuristic, interactive one. Work on `dev` only. Do not change app behaviour, routes, auth or APIs. Only the landing page, its styles, static assets and `lib/marketing-config.ts` change.

## Truth rules (copy must match what the product really does today)

- A QR scan is a redirect visit to the saved Google review link. It is not a completed review. Never promise more reviews.
- Review collection: one QR per business, links through a PrimeReviews short link, so the Google review link can be edited later without reprinting. Scans are counted per day; bots and link previews are excluded where detectable; raw IP addresses are not stored.
- QR Studio: card designed automatically from the business type (11 types plus Other); four designs behind one Shuffle button; optional ambience photo (JPG/PNG/WebP up to 5 MB, metadata removed, stored compressed to 80 KB or less); 50+ curated taglines per business type (funny, friendly, professional) or your own up to 60 characters; black-and-white print mode; download as JPG; every card is checked to be scannable.
- Dashboard: current Google rating and review count, rating change and new reviews for 7, 30, 90 days or custom dates, QR scans over time, three charts. Google figures come from Google Places and are cached for 24 hours.
- Local rankings: nearby businesses of the owner's own business type within 1, 3 or 5 km, up to 20 results, Google ratings and review counts. It will not match a browser Google search exactly. No results for the Other type.
- Not built yet, so labelled "Coming soon" or left out: Google Business Profile sync, importing or replying to reviews, multiple locations, automated reports, AI insights.
- No invented numbers, customers, testimonials or prices. Sample images and sample data are labelled "Sample". Pricing becomes "Free while we are in early access"; paid plans are "Coming soon" with no price.
- Never tell customers to offer rewards for reviews (against Google policy).

## Experience

Dark, futuristic look: deep navy background, animated aurora and grid, violet / cyan / pink accents, glass cards, glowing borders.

1. Hero: gradient headline, 3D-tilt sample QR card that follows the pointer, floating sample stat chips, scroll progress bar, soft cursor glow.
2. How it works: three equal-height cards that flip in 3D.
   - Step 1 (click or tap): flips to a sample restaurant photo, showing the business look.
   - Step 2: flips by itself when scrolled into view to a sample generated QR card; click flips it back.
   - Step 3 (click or tap): flips to an animated sample dashboard.
3. Try a scan: phone demo that simulates a scan and shows the Google review screen.
4. Works for your business: pick a business type and the preview card changes colours and icon.
5. Features: bento grid with pointer-following glow; unfinished ones marked Coming soon.
6. Local rankings preview with animated bars (Sample data).
7. Facts strip with count-up numbers taken only from the real product (11 types, 4 designs, 50+ taglines, 1/3/5 km).
8. Early access pricing, honest FAQ (10 questions), final call to action, useful footer.

## Quality bar

- Respect `prefers-reduced-motion` (no spin, parallax or auto flips; content still reachable).
- Flip cards are buttons with `aria-pressed`; hidden faces are `aria-hidden`; keyboard operable.
- Responsive from 360 px up, no horizontal scroll.
- Fast: no new runtime dependencies, images compressed (WebP/JPG, under about 200 KB each), `loading="lazy"` below the fold, animations use transform and opacity only.
- Works with the existing CSP (no external fonts, scripts or images).
- Check with typecheck, build, screenshots at desktop and phone widths, and the existing test suites.
