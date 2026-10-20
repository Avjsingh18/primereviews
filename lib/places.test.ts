import assert from "node:assert/strict";
import test from "node:test";
import { GooglePlacesError, GooglePlacesProvider } from "./google-places";
import { isPlaceId, placeIdFromReviewUrl } from "./places-id";

const withFetch = async (handler: (input: RequestInfo | URL, init?: RequestInit) => Response, run: () => Promise<void>) => {
  const originalFetch = global.fetch; const originalKey = process.env.GOOGLE_MAPS_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY = "fixture-key"; global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler(input, init)) as typeof fetch;
  try { await run(); } finally { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = originalKey; }
};

test("place IDs accept Google's character set and reject anything else", () => {
  assert.ok(isPlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4"));
  assert.ok(!isPlaceId("short"));
  assert.ok(!isPlaceId("ChIJ with spaces and ../ slashes"));
  assert.ok(!isPlaceId(42)); assert.ok(!isPlaceId(undefined));
});

test("a place ID is read from review links that carry one, and only from Google hosts", () => {
  assert.equal(placeIdFromReviewUrl("https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4"), "ChIJN1t_tDeuEmsRUsoyG83frY4");
  assert.equal(placeIdFromReviewUrl("https://www.google.com/maps/search/?api=1&query=x&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4"), "ChIJN1t_tDeuEmsRUsoyG83frY4");
  assert.equal(placeIdFromReviewUrl("https://g.page/r/CabcDEF123/review"), null);
  assert.equal(placeIdFromReviewUrl("https://evil.example/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4"), null);
  assert.equal(placeIdFromReviewUrl("http://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4"), null);
  assert.equal(placeIdFromReviewUrl("not a url"), null);
});

test("business search uses the typed words only, with no location, and drops closed or unplottable listings", async () => {
  let sent: { url: string; body: Record<string, unknown>; mask: string } | undefined;
  await withFetch((input, init) => {
    sent = { url: String(input), body: JSON.parse(String(init?.body)), mask: String((init?.headers as Record<string, string>)["X-Goog-FieldMask"]) };
    return new Response(JSON.stringify({ places: [
      { id: "ChIJopenOne0001", displayName: { text: "Sharma Dental" }, formattedAddress: "Sector 18, Noida", location: { latitude: 28.57, longitude: 77.32 }, businessStatus: "OPERATIONAL" },
      { id: "ChIJclosed00002", displayName: { text: "Old Clinic" }, location: { latitude: 28.5, longitude: 77.3 }, businessStatus: "CLOSED_PERMANENTLY" },
      { id: "ChIJnoloc000003", displayName: { text: "No Location" } },
    ] }), { status: 200 });
  }, async () => {
    const found = await new GooglePlacesProvider().searchBusinesses("Sharma Dental Noida");
    assert.deepEqual(found, [{ placeId: "ChIJopenOne0001", name: "Sharma Dental", address: "Sector 18, Noida", latitude: 28.57, longitude: 77.32 }]);
    assert.ok(sent?.url.endsWith("/places:searchText"));
    assert.equal(sent?.body.textQuery, "Sharma Dental Noida");
    assert.ok(!("locationBias" in (sent?.body ?? {})) && !("locationRestriction" in (sent?.body ?? {})));
    assert.ok(!/rating|userRatingCount/.test(sent?.mask ?? ""), "search results must not request the pricier rating fields");
  });
});

test("a chosen place is looked up by ID and its rating comes from that exact listing", async () => {
  let requested = "";
  await withFetch((input) => {
    requested = String(input);
    return new Response(JSON.stringify({ id: "ChIJopenOne0001", displayName: { text: "Sharma Dental" }, formattedAddress: "Sector 18, Noida", location: { latitude: 28.57, longitude: 77.32 }, rating: 4.6, userRatingCount: 212, googleMapsUri: "https://maps.google.com/?cid=1" }), { status: 200 });
  }, async () => {
    const provider = new GooglePlacesProvider();
    const place = await provider.getPlace("ChIJopenOne0001");
    assert.ok(requested.endsWith("/places/ChIJopenOne0001"));
    assert.equal(place.name, "Sharma Dental"); assert.equal(place.closed, false);
    const metrics = await provider.getBusinessMetricsByPlaceId("ChIJopenOne0001");
    assert.equal(metrics.rating, 4.6); assert.equal(metrics.reviewCount, 212); assert.equal(metrics.placeId, "ChIJopenOne0001");
  });
});

test("unknown places and listings without a rating are reported clearly", async () => {
  await withFetch(() => new Response("{}", { status: 404 }), async () => {
    await assert.rejects(() => new GooglePlacesProvider().getPlace("ChIJmissing00004"), (cause) => cause instanceof GooglePlacesError && cause.status === 404);
  });
  await withFetch(() => new Response(JSON.stringify({ id: "ChIJnorating0005", displayName: { text: "New Shop" }, location: { latitude: 1, longitude: 1 } }), { status: 200 }), async () => {
    await assert.rejects(() => new GooglePlacesProvider().getBusinessMetricsByPlaceId("ChIJnorating0005"), (cause) => cause instanceof GooglePlacesError && cause.status === 404);
  });
});
