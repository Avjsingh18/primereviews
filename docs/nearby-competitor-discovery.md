# Nearby competitor discovery

ReviewFlow searches from the signed-in business's saved coordinates. The browser sends only a category and a radius; it never sends a business ID or location to choose another business.

## Configure

Add these server-only values to `.env.local` for local development or to Vercel environment variables for deployment:

```env
OPENAI_API_KEY=...
COMPETITOR_SEARCH_PROVIDER=openai
COMPETITOR_SEARCH_MODEL=gpt-5.5
COMPETITOR_SEARCH_LIMIT=25
COMPETITOR_SEARCH_TIMEOUT_MS=30000
COMPETITOR_SEARCH_CACHE_TTL_SECONDS=86400
```

Restart the server after changing environment variables. `OPENAI_API_KEY` is never sent to the browser.

## Request contract

`POST /api/benchmark`

```json
{ "category": "cafe", "radiusKm": 3, "limit": 25, "refresh": false }
```

The server validates the category, 1/3/5 km radius, maximum 25 results, authentication, and the saved business location. It then invokes OpenAI's Responses API with the hosted `web_search` tool and structured JSON output.

## Accuracy rules

- A Haversine calculation filters records with supplied coordinates to the selected radius.
- Listings without coordinates remain visibly marked as needing location verification.
- The app only displays a Google rating or review count when the model supplied a direct cited `google.com` source URL. Otherwise it displays `Not available` or `Not verified`.
- Permanently closed and duplicate listings are removed. Fewer than 25 results is a valid outcome.

## Caching and limits

Results are cached in server memory for the configured TTL (24 hours by default), and duplicate concurrent requests are coalesced. This keeps the initial implementation simple and avoids persisting third-party listing data. The cache resets when a server instance restarts or scales, so it is not a shared distributed cache.

## Limitations

The private structured local-business search available inside ChatGPT is not used or accessible by this application. This feature uses the documented OpenAI Responses API web-search tool instead. A live provider-backed test requires a valid `OPENAI_API_KEY`; without one, the app intentionally returns a configuration error and never substitutes demo businesses.
