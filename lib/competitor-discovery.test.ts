import assert from "node:assert/strict";
import test from "node:test";
import { haversineDistanceKm } from "./competitor-discovery";
import { GooglePlacesProvider } from "./google-places";

test("haversine handles 1 km, 3 km, and 5 km radius checks", () => {
  const origin = { latitude: 28.62127, longitude: 77.42985 };
  assert.equal(haversineDistanceKm(origin.latitude, origin.longitude, origin.latitude, origin.longitude), 0);
  assert.ok(haversineDistanceKm(origin.latitude, origin.longitude, 28.627, origin.longitude) < 1);
  assert.ok(haversineDistanceKm(origin.latitude, origin.longitude, 28.645, origin.longitude) < 3);
  assert.ok(haversineDistanceKm(origin.latitude, origin.longitude, 28.667, origin.longitude) > 5);
});

test("Google Places Nearby Search uses the selected radius and filters invalid listings", async () => {
  const originalFetch = global.fetch; const originalKey = process.env.GOOGLE_MAPS_API_KEY; process.env.GOOGLE_MAPS_API_KEY = "fixture-key";
  let sent: RequestInit | undefined;
  global.fetch = async (_input, init) => {
    sent = init;
    return new Response(JSON.stringify({ places: [
      { id:"one", displayName:{ text:"Alpha Cafe" }, formattedAddress:"One Road", location:{ latitude:28.625, longitude:77.432 }, rating:4.8, userRatingCount:120, googleMapsUri:"https://maps.google.com/?cid=1", primaryType:"cafe", businessStatus:"OPERATIONAL" },
      { id:"closed", displayName:{ text:"Closed Cafe" }, location:{ latitude:28.625, longitude:77.432 }, businessStatus:"CLOSED_PERMANENTLY" },
      { id:"far", displayName:{ text:"Far Cafe" }, location:{ latitude:28.8, longitude:77.8 }, businessStatus:"OPERATIONAL" },
    ] }), { status:200 });
  };
  try {
    const result = await new GooglePlacesProvider().searchNearbyBusinesses({ latitude:28.62127, longitude:77.42985, category:"cafe", radiusKm:3, limit:20 });
    const body = JSON.parse(String(sent?.body));
    assert.equal(body.locationRestriction.circle.radius, 3000);
    assert.deepEqual(body.includedTypes, ["cafe"]);
    assert.equal(result.businesses.length, 1);
    assert.equal(result.businesses[0].name, "Alpha Cafe");
    assert.equal(result.businesses[0].rating, 4.8);
    assert.equal(result.businesses[0].reviewCount, 120);
    assert.equal(result.businesses[0].distanceVerified, true);
    assert.equal(result.provider, "google_places");
    assert.equal(result.sourceStatus, "verified");
  } finally { global.fetch = originalFetch; if (originalKey == null) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = originalKey; }
});

test("Google Places finds the current business by matching its name and location", async () => {
  const originalFetch = global.fetch; const originalKey = process.env.GOOGLE_MAPS_API_KEY; process.env.GOOGLE_MAPS_API_KEY = "fixture-key";
  global.fetch = async () => new Response(JSON.stringify({ places: [
    { id:"wrong", displayName:{ text:"Different Nursery" }, location:{ latitude:28.6213, longitude:77.4298 }, rating:4.9, userRatingCount:999 },
    { id:"right", displayName:{ text:"R Serto Nursery" }, location:{ latitude:28.6213, longitude:77.4298 }, rating:4.7, userRatingCount:63, googleMapsUri:"https://maps.google.com/?cid=2" },
  ] }), { status:200 });
  try {
    const result = await new GooglePlacesProvider().findBusinessMetrics({ name:"R.SERTO NURSERY", latitude:28.62127, longitude:77.42985 });
    assert.equal(result.placeId, "right");
    assert.equal(result.rating, 4.7);
    assert.equal(result.reviewCount, 63);
  } finally { global.fetch = originalFetch; if (originalKey == null) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = originalKey; }
});

test("Google Places fails closed when it is not configured", async () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY; delete process.env.GOOGLE_MAPS_API_KEY;
  try { await assert.rejects(() => new GooglePlacesProvider().searchNearbyBusinesses({ latitude:28.62127, longitude:77.42985, category:"cafe", radiusKm:3, limit:20 }), /not configured/); }
  finally { if (originalKey != null) process.env.GOOGLE_MAPS_API_KEY = originalKey; }
});
