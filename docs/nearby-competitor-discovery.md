# Nearby competitor discovery

ReviewFlow uses **Google Places API (New)** for two live, public-data features:

- local rankings: similar businesses within a saved 1 km, 3 km, or 5 km radius;
- the signed-in business's current public Google rating and review count.

This is not Google Business Profile owner syncing. It does not read individual reviews or publish replies.

## Configure

Enable **Places API (New)** in the Google Cloud project, then add this server-only value to `.env.local` for local development or Vercel environment variables for deployment:

```env
GOOGLE_MAPS_API_KEY=...
```

Do not prefix the variable with `NEXT_PUBLIC_`; the browser must never receive the key. Restrict it to Places API (New). Restart the server after changing environment variables.

## Request contract

`POST /api/benchmark`

```json
{ "category": "cafe", "radiusKm": 3, "limit": 20 }
```

The server validates the category, 1/3/5 km radius, maximum 20 results, authentication, and the signed-in business's saved coordinates. It calls Google Nearby Search with a precise field mask and independently verifies the returned latitude/longitude with the Haversine formula.

## Accuracy and caching

- Ratings and review counts shown by this page come directly from Google Places.
- Permanently closed listings, duplicates, and records outside the selected radius are excluded.
- Google Places returns at most 20 nearby results per request; a smaller result set is valid.
- Ranking data and the current-business metrics are cached privately and securely for exactly 24 hours. They refresh automatically once that cache entry expires.
- The current business is matched by its saved name and location. If the match is ambiguous, the app returns no owner metrics rather than guessing.

The temporary cache is limited to the data required to render ReviewFlow and is within Google's temporary performance-cache allowance. Keep Google attribution and links intact when displaying the data.
