import assert from "node:assert/strict";
import test from "node:test";
import { haversineDistanceKm, OpenAIWebSearchProvider } from "./competitor-discovery";

test("haversine handles 1 km, 3 km, and 5 km radius checks", () => {
  const origin = { latitude: 28.62127, longitude: 77.42985 };
  assert.equal(haversineDistanceKm(origin.latitude, origin.longitude, origin.latitude, origin.longitude), 0);
  assert.ok(haversineDistanceKm(origin.latitude, origin.longitude, 28.627, origin.longitude) < 1);
  assert.ok(haversineDistanceKm(origin.latitude, origin.longitude, 28.645, origin.longitude) < 3);
  assert.ok(haversineDistanceKm(origin.latitude, origin.longitude, 28.667, origin.longitude) > 5);
});

test("provider removes duplicates, unrelated categories, closed listings, and out-of-radius records", async () => {
  const originalFetch = global.fetch;
  const sourceUrl = "https://www.google.com/maps/place/Alpha+Cafe";
  const body = JSON.stringify({ businesses: [
    { name:"Alpha Cafe", category:"Cafe", address:"One Road", rating:4.8, reviewCount:120, ratingSource:"google", latitude:28.625, longitude:77.432, sourceUrl, googleMapsUrl:sourceUrl, permanentlyClosed:false },
    { name:"Alpha Cafe", category:"Cafe", address:"One Road", rating:4.8, reviewCount:120, ratingSource:"google", latitude:28.625, longitude:77.432, sourceUrl, googleMapsUrl:sourceUrl, permanentlyClosed:false },
    { name:"Far Cafe", category:"Cafe", address:"Outside", rating:4.7, reviewCount:33, ratingSource:"google", latitude:28.8, longitude:77.8, sourceUrl, googleMapsUrl:null, permanentlyClosed:false },
    { name:"Closed Cafe", category:"Cafe", address:"Closed", rating:null, reviewCount:null, ratingSource:null, latitude:null, longitude:null, sourceUrl:null, googleMapsUrl:null, permanentlyClosed:true },
    { name:"Unrelated Restaurant", category:"Restaurant", address:"Elsewhere", rating:null, reviewCount:null, ratingSource:null, latitude:null, longitude:null, sourceUrl:null, googleMapsUrl:null, permanentlyClosed:false },
    { name:"Unverified Cafe", category:"Cafe", address:null, rating:4.9, reviewCount:2, ratingSource:"other", latitude:null, longitude:null, sourceUrl:null, googleMapsUrl:null, permanentlyClosed:false },
  ] });
  global.fetch = async () => new Response(JSON.stringify({ output_text: body, output:[{ type:"message", content:[{ type:"output_text", text:body, annotations:[{ type:"url_citation", url:sourceUrl }] }] }] }), { status:200 });
  try {
    const result = await new OpenAIWebSearchProvider("test", 1000, "test").searchNearbyBusinesses({ latitude:28.62127, longitude:77.42985, category:"cafe", radiusKm:3, limit:25 });
    assert.equal(result.businesses.length, 2);
    assert.equal(result.businesses[0].name, "Alpha Cafe");
    assert.equal(result.businesses[0].rating, 4.8);
    assert.equal(result.businesses[0].verificationStatus, "needs_verification");
    assert.equal(result.businesses[0].distanceVerified, false);
    assert.equal(result.sourceStatus, "partially_verified");
    assert.equal(result.isComplete, false);
    assert.equal(result.businesses[1].name, "Unverified Cafe");
    assert.equal(result.businesses[1].rating, null);
    assert.equal(result.businesses[1].distanceVerified, false);
  } finally { global.fetch = originalFetch; }
});

test("provider times out instead of returning fabricated results", async () => {
  const originalFetch = global.fetch;
  global.fetch = (_input, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError"))));
  try {
    await assert.rejects(() => new OpenAIWebSearchProvider("test", 20, "test").searchNearbyBusinesses({ latitude:28.62127, longitude:77.42985, category:"cafe", radiusKm:3, limit:25 }));
  } finally { global.fetch = originalFetch; }
});
