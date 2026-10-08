import { NextRequest, NextResponse } from "next/server";
import { categories, Category, haversineDistanceKm, NearbySearchResponse, OpenAIWebSearchProvider } from "@/lib/competitor-discovery";
import { error, requireUser } from "@/lib/api";
import { getCachedJson, setCachedJson } from "@/lib/supabase-cache";
import { consumeRateLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

type CurrentBusiness = { id: string; identity: string; latitude: number; longitude: number; rating: number | null; reviewCount: number | null };
type SearchInput = { category?: unknown; radiusKm?: unknown; limit?: unknown };
type CachedResult = NearbySearchResponse & { cached: boolean };

const inFlight = new Map<string, Promise<CachedResult>>();
const lastRequestByBusiness = new Map<string, number>();
const cacheTtlMs = Math.max(60, Number(process.env.COMPETITOR_SEARCH_CACHE_TTL_SECONDS || 86400)) * 1000;
const requestCooldownMs = 5_000;

function validSearch(input: SearchInput) {
  const category = typeof input.category === "string" && input.category in categories ? input.category as Category : null;
  const radiusKm = Number(input.radiusKm); const limit = input.limit == null ? 25 : Number(input.limit);
  if (!category) return { problem: "Choose a valid business category." };
  if (![1, 3, 5].includes(radiusKm)) return { problem: "Choose a 1 km, 3 km, or 5 km radius." };
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) return { problem: "Choose between 1 and 25 businesses." };
  return { category, radiusKm: radiusKm as 1 | 3 | 5, limit };
}

function hasCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

async function productionBusiness(request: NextRequest): Promise<CurrentBusiness | NextResponse> {
  const auth = await requireUser(request); if ("response" in auth && auth.response) return auth.response;
  const { data: business, error: businessError } = await auth.supabase.from("businesses").select("id,latitude,longitude").eq("user_id", auth.user.id).maybeSingle();
  if (businessError) return error("The business location migration has not been applied yet.", 409);
  if (!business) return error("Complete onboarding to create your business.", 404);
  if (!hasCoordinates(business.latitude, business.longitude)) return error("Add your business location to find nearby competitors.", 409);
  const { data: snapshots } = await auth.supabase.from("review_snapshots").select("rating,total_reviews").eq("business_id", business.id).order("snapshot_date", { ascending: false }).limit(1);
  const latest = snapshots?.[0];
  return { id: business.id, identity: auth.user.id, latitude: business.latitude!, longitude: business.longitude!, rating: latest?.rating ?? null, reviewCount: latest?.total_reviews ?? null };
}

function cacheKey(business: CurrentBusiness, category: Category, radiusKm: number, limit: number) {
  return [business.id, business.latitude.toFixed(5), business.longitude.toFixed(5), category, radiusKm, limit, process.env.COMPETITOR_SEARCH_PROVIDER || "openai"].join(":");
}

function normalize(response: NearbySearchResponse, business: CurrentBusiness): CachedResult {
  const businesses = response.businesses.map((competitor) => {
    const distanceKm = competitor.latitude != null && competitor.longitude != null ? Number(haversineDistanceKm(business.latitude, business.longitude, competitor.latitude, competitor.longitude).toFixed(2)) : null;
    return { ...competitor, distanceKm, distanceVerified: distanceKm != null };
  });
  return { ...response, businesses, cached: false };
}

export async function POST(request: NextRequest) {
  const input = validSearch(await request.json().catch(() => ({})));
  if ("problem" in input) return error(input.problem ?? "Choose valid nearby-business search options.");
  const business = await productionBusiness(request);
  if (business instanceof NextResponse) return business;
  if ((process.env.COMPETITOR_SEARCH_PROVIDER || "openai") !== "openai") return error("Nearby competitor search is not configured.", 503);
  if (!process.env.OPENAI_API_KEY) return error("Nearby competitor search is not configured. Add OPENAI_API_KEY on the server to enable it.", 503);
  const limiters = await Promise.all([
    consumeRateLimit(requestRateLimitKey(request, "benchmark", business.identity), 10, 3600),
    consumeRateLimit(requestRateLimitKey(request, "benchmark-ip"), 30, 3600),
  ]);
  for (const limiter of limiters) {
    if (limiter.unavailable) return rateLimitUnavailableResponse();
    if (!limiter.allowed) return rateLimitResponse(limiter.retryAfter);
  }
  const key = cacheKey(business, input.category, input.radiusKm, input.limit);
  const cached = await getCachedJson<CachedResult>(`reviewflow:benchmark:${key}`);
  if (cached) return NextResponse.json({ success: true, search: { latitude: business.latitude, longitude: business.longitude, category: input.category, radiusMeters: input.radiusKm * 1000, requestedLimit: input.limit }, metadata: { returnedCount: cached.businesses.length, searchedAt: cached.searchedAt, provider: cached.provider, sourceStatus: cached.sourceStatus, isComplete: cached.isComplete, cached: true }, myBusiness: { rating: business.rating, reviewCount: business.reviewCount }, businesses: cached.businesses });
  if (inFlight.has(key)) {
    const value = await inFlight.get(key)!;
    return NextResponse.json({ success: true, search: { latitude: business.latitude, longitude: business.longitude, category: input.category, radiusMeters: input.radiusKm * 1000, requestedLimit: input.limit }, metadata: { returnedCount: value.businesses.length, searchedAt: value.searchedAt, provider: value.provider, sourceStatus: value.sourceStatus, isComplete: value.isComplete, cached: value.cached }, myBusiness: { rating: business.rating, reviewCount: business.reviewCount }, businesses: value.businesses });
  }
  const now = Date.now();
  if (now - (lastRequestByBusiness.get(business.identity) || 0) < requestCooldownMs) return error("Please wait a few seconds before starting another nearby-business search.", 429);
  lastRequestByBusiness.set(business.identity, now);

  const search = (async () => {
    const provider = new OpenAIWebSearchProvider(process.env.OPENAI_API_KEY!, Math.max(5_000, Number(process.env.COMPETITOR_SEARCH_TIMEOUT_MS || 30000)), process.env.COMPETITOR_SEARCH_MODEL || "gpt-5.5");
    const result = normalize(await provider.searchNearbyBusinesses({ latitude: business.latitude, longitude: business.longitude, category: input.category, radiusKm: input.radiusKm, limit: input.limit }), business);
    await setCachedJson(`reviewflow:benchmark:${key}`, result, Math.floor(cacheTtlMs / 1000));
    return result;
  })();
  inFlight.set(key, search);
  try {
    const value = await search;
    return NextResponse.json({ success: true, search: { latitude: business.latitude, longitude: business.longitude, category: input.category, radiusMeters: input.radiusKm * 1000, requestedLimit: input.limit }, metadata: { returnedCount: value.businesses.length, searchedAt: value.searchedAt, provider: value.provider, sourceStatus: value.sourceStatus, isComplete: value.isComplete, cached: false }, myBusiness: { rating: business.rating, reviewCount: business.reviewCount }, businesses: value.businesses });
  } catch (cause) {
    console.error("Competitor discovery failed", { message: cause instanceof Error ? cause.message : "unknown" });
    return error("We couldn’t retrieve nearby businesses right now. Please try again.", 502);
  } finally { inFlight.delete(key); }
}
