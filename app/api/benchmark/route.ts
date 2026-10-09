import { NextRequest } from "next/server";
import { categories, Category, NearbySearchResponse, OpenAIWebSearchProvider } from "@/lib/competitor-discovery";
import { error, requireUser } from "@/lib/api";
import { getCachedJson, setCachedJson } from "@/lib/supabase-cache";
import { enforceLimit } from "@/lib/rate-limit";
import { aiCacheKey, aiConfiguration, finishAi, reserveAi } from "@/lib/security/ai";
import { json, readJson, safeRoute } from "@/lib/security/http";
export const runtime = "nodejs";

export const POST = safeRoute(async (request: NextRequest) => {
  aiConfiguration("competitors");
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const input = await readJson(request);
  if (typeof input.category !== "string" || !Object.hasOwn(categories, input.category) || typeof input.radiusKm !== "number" || ![1, 3, 5].includes(input.radiusKm) || (input.limit != null && (typeof input.limit !== "number" || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 25))) return error("Choose a valid category, radius, and result limit.");
  const category = input.category as Category; const radiusKm = input.radiusKm as 1 | 3 | 5; const limit = input.limit == null ? 25 : Number(input.limit);
  await enforceLimit(request, "competitors-user", 10, 3600, auth.user.id);
  await enforceLimit(request, "competitors-ip", 30, 3600);
  const { data: business } = await auth.supabase.from("businesses").select("id,latitude,longitude").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return error("Complete onboarding first.", 404);
  if (typeof business.latitude !== "number" || typeof business.longitude !== "number" || !Number.isFinite(business.latitude) || !Number.isFinite(business.longitude) || Math.abs(business.latitude) > 90 || Math.abs(business.longitude) > 180) return error("Add your business location in Settings first.", 409);
  const { data: snapshots } = await auth.supabase.from("review_snapshots").select("rating,total_reviews").eq("business_id", business.id).order("snapshot_date", { ascending: false }).limit(1);
  const key = aiCacheKey("competitors", auth.user.id, [business.id, business.latitude, business.longitude, category, radiusKm, limit]);
  let result = await getCachedJson<NearbySearchResponse>(key, auth.user.id); const cached = Boolean(result);
  if (!result) {
    const reservation = await reserveAi(key, auth.user.id, "competitors");
    try {
      result = await new OpenAIWebSearchProvider(reservation.apiKey, 30000, reservation.model).searchNearbyBusinesses({ latitude: business.latitude, longitude: business.longitude, category, radiusKm, limit });
      await setCachedJson(key, auth.user.id, result, 86400);
      await finishAi(key, reservation.reservation, "complete");
    } catch {
      await finishAi(key, reservation.reservation, "failed");
      return error("Nearby-business search is unavailable. Please try again later.", 502);
    }
  }
  return json({ success: true, search: { latitude: business.latitude, longitude: business.longitude, category, radiusMeters: radiusKm * 1000, requestedLimit: limit }, metadata: { returnedCount: result.businesses.length, searchedAt: result.searchedAt, provider: result.provider, sourceStatus: result.sourceStatus, isComplete: false, cached }, myBusiness: { rating: snapshots?.[0]?.rating ?? null, reviewCount: snapshots?.[0]?.total_reviews ?? null }, businesses: result.businesses });
});
