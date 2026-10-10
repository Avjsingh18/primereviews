// Local UI preview only. Serves sample data for /api/* so every page can be viewed without Supabase keys.
// Never used in production: next.config.mjs only proxies to this server when UI_MOCK_API=true.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const port = Number(process.env.UI_MOCK_PORT || 3101);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const taglineData = JSON.parse(fs.readFileSync(path.join(root, "data/qr_taglines.json"), "utf8"));
const origin = process.env.UI_MOCK_SITE || "http://localhost:3100";

const state = {
  business: { id: "demo-business", name: "Saffron Table", slug: "saffron-table-demo", googleReviewUrl: "https://g.page/r/demo/review", latitude: 28.62127, longitude: 77.42985, category: "restaurants" },
  design: { variantIndex: 0, tagline: "Loved the food? Tell us!", taglineSource: "preset", bwMode: false, seen: [0], version: 1 },
  photo: false,
};
const send = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve) => { let data = ""; req.on("data", (chunk) => (data += chunk)); req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } }); });
const iso = (offset = 0) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
const noise = (i, seed) => Math.abs(Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1;

function series(start, end, fn) {
  const out = []; const from = new Date(`${start}T00:00:00Z`); const to = new Date(`${end}T00:00:00Z`);
  for (let i = 0, d = new Date(from); d <= to && i < 400; i++, d.setUTCDate(d.getUTCDate() + 1)) out.push({ date: d.toISOString().slice(0, 10), value: fn(i, out.length) });
  return out;
}
function overview(url) {
  const start = url.searchParams.get("start") || iso(-29); const end = url.searchParams.get("end") || iso();
  const scans = series(start, end, (i) => Math.round(8 + noise(i, 1) * 26 + i * 0.35));
  const reviews = series(start, end, (i) => 1180 + Math.round(i * 1.6 + noise(i, 2) * 3));
  const ratings = series(start, end, (i) => Number((4.4 + Math.min(i, 40) * 0.006 + noise(i, 3) * 0.04).toFixed(1)));
  const last = reviews[reviews.length - 1]?.value ?? 1200; const first = reviews[0]?.value ?? 1180;
  return { rating: ratings[ratings.length - 1]?.value ?? 4.6, totalReviews: last, newReviews: last - first, ratingChange: 0.2, qrScans: scans.reduce((a, b) => a + b.value, 0), rangeStart: start, rangeEnd: end, ratings, reviews, scans };
}
function taglines(category, tone) {
  const key = { cafes: "cafes", restaurants: "restaurants", hotels: "hotels", pg: "pg", salons: "salons", clinics: "clinics", coaching_centres: "coaching_centres", plant_nurseries: "plant_nurseries", day_care: "day_care", preschools: "preschools", gyms: "gyms" }[category];
  return taglineData.categories?.[key]?.[tone] ?? ["Tell us about your experience"];
}
const trackingUrl = () => `${origin}/r/${state.business.slug}`;
function designPayload() {
  const d = state.design;
  return { id: "demo-design", category: state.business.category, variantIndex: d.variantIndex, tagline: d.tagline, taglineSource: d.taglineSource, bwMode: d.bwMode, renderUrl: `/api/qr-studio/render/${"a".repeat(63)}${d.version % 10}.jpg`, businessName: state.business.name, trackingUrl: trackingUrl(), seenVariants: d.seen };
}
const places = [
  ["Brew Lane Kitchen", 4.7, 612, 0.8], ["The Corner Table", 4.5, 940, 1.2], ["Saffron Table (sample)", 4.6, 1203, 0.1], ["Daily Grind Diner", 4.3, 388, 2.1], ["Bean Street Bistro", 4.1, 204, 2.6], ["Spice Route", 4.4, 731, 1.9], ["Urban Tandoor", 4.2, 455, 3.3], ["Little Italy House", 4.6, 520, 3.8],
];
function benchmark(radiusKm) {
  const now = new Date().toISOString();
  const businesses = places.filter((p) => p[3] <= radiusKm && !p[0].includes("sample")).map(([name, rating, reviewCount, distanceKm], i) => ({ id: `p${i}`, name, category: state.business.category, address: `${12 + i} Market Road, Sample City`, rating, reviewCount, ratingSource: "google", distanceKm, distanceVerified: true, sourceUrl: null, googleMapsUrl: "https://maps.google.com", verificationStatus: "verified", retrievedAt: now }));
  return { success: true, search: { latitude: state.business.latitude, longitude: state.business.longitude, category: state.business.category, radiusMeters: radiusKm * 1000, requestedLimit: 20 }, metadata: { returnedCount: businesses.length, searchedAt: now, provider: "sample", sourceStatus: "verified", isComplete: true, cached: false }, myBusiness: { rating: 4.6, reviewCount: 1203, cached: false }, businesses };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://mock");
  const route = url.pathname; const method = req.method || "GET";
  if (route === "/api/auth/login" || route === "/api/auth/register") {
    await readBody(req);
    const cookie = `prime_reviews_session=${randomBytes(32).toString("base64url")}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
    return send(res, 200, { businessName: state.business.name, onboardingRequired: false }, { "Set-Cookie": cookie });
  }
  if (route === "/api/auth/logout") return send(res, 200, { ok: true }, { "Set-Cookie": "prime_reviews_session=; Path=/; HttpOnly; Max-Age=0" });
  if (route === "/api/auth/change-password") return send(res, 200, { ok: true });
  if (route === "/api/business" && method === "GET") return send(res, 200, { ...state.business, trackingUrl: trackingUrl() });
  if (route === "/api/business") { const body = await readBody(req); Object.assign(state.business, { name: body.name ?? state.business.name, googleReviewUrl: body.googleReviewUrl ?? state.business.googleReviewUrl, category: body.category ?? state.business.category, latitude: body.latitude ?? state.business.latitude, longitude: body.longitude ?? state.business.longitude }); return send(res, 200, { ...state.business, trackingUrl: trackingUrl() }); }
  if (route === "/api/business/qr") return send(res, 200, { id: "demo-qr", slug: state.business.slug, trackingUrl: trackingUrl() });
  if (route.startsWith("/api/analytics/overview")) return send(res, 200, overview(url));
  if (route.startsWith("/api/analytics/")) { const o = overview(url); return send(res, 200, { series: route.endsWith("scans") ? o.scans : route.endsWith("rating") ? o.ratings : o.reviews }); }
  if (route === "/api/benchmark") { const body = await readBody(req); return send(res, 200, benchmark(body.radiusKm || 3)); }
  if (route === "/api/qr-studio/taglines") { const tone = url.searchParams.get("tone") || "friendly"; return send(res, 200, { category: state.business.category, tone, taglines: taglines(state.business.category, tone) }); }
  if (route === "/api/qr-studio/photo") { if (method === "POST") { state.photo = true; state.design.version++; return send(res, 200, { bytes: 43000, palette: {} }); } state.photo = false; state.design.version++; return send(res, 200, { removed: true }); }
  if (route.startsWith("/api/qr-studio/render/")) {
    const file = path.join(root, "public/landing", state.business.category === "cafes" || state.design.variantIndex >= 2 ? "sample-qr-bold.jpg" : "sample-qr.jpg");
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store" }); return res.end(fs.readFileSync(file));
  }
  if (route === "/api/qr-studio") {
    if (method === "POST") {
      const body = await readBody(req); const d = state.design;
      if (body.mode === "shuffle") { const others = [0, 1, 2, 3].filter((i) => i !== d.variantIndex); const fresh = others.filter((i) => !d.seen.includes(i)); const pool = fresh.length ? fresh : others; if (!fresh.length) d.seen = [d.variantIndex]; d.variantIndex = pool[Math.floor(Math.random() * pool.length)]; d.seen = [...new Set([...d.seen, d.variantIndex])]; }
      if (body.taglineSource === "custom" && typeof body.tagline === "string") { d.tagline = body.tagline.slice(0, 60); d.taglineSource = "custom"; }
      else if (typeof body.tagline === "string") { d.tagline = body.tagline; d.taglineSource = "preset"; }
      if (typeof body.bwMode === "boolean") d.bwMode = body.bwMode;
      d.version++;
      return send(res, 200, { design: designPayload() });
    }
    return send(res, 200, { design: designPayload(), category: state.business.category });
  }
  return send(res, 404, { error: "Not part of the local preview." });
});
server.listen(port, () => console.log(`UI preview data server on http://localhost:${port}`));
