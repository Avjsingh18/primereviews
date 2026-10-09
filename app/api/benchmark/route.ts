import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { categories, Category, NearbySearchResponse } from "@/lib/competitor-discovery";
import { GooglePlacesError, GooglePlacesProvider } from "@/lib/google-places";
import { getCurrentGoogleBusinessMetrics } from "@/lib/google-business-metrics";
import { error, requireUser } from "@/lib/api";
import { getCachedJson, setCachedJson } from "@/lib/supabase-cache";
import { enforceLimit } from "@/lib/rate-limit";
import { json, readJson, safeRoute } from "@/lib/security/http";
export const runtime = "nodejs";

function cacheKey(ownerId: string, value: unknown) {
  return `google-nearby:v1:${createHash("sha256").update(JSON.stringify([ownerId, value])).digest("hex")}`;
}

export const POST = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const input = await readJson(request);
  if (typeof input.category !== "string" || !Object.hasOwn(categories, input.category) || typeof input.radiusKm !== "number" || ![1, 3, 5].includes(input.radiusKm) || (input.limit != null && (typeof input.limit !== "number" || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 20))) return error("Choose a valid category, radius, and result limit.");
  const category = input.category as Category; const radiusKm = input.radiusKm as 1 | 3 | 5; const limit = input.limit == null ? 20 : Number(input.limit);
  await enforceLimit(request, "competitors-user", 10, 3600, auth.user.id);
  await enforceLimit(request, "competitors-ip", 30, 3600);
  const { data: business } = await auth.supabase.from("businesses").select("id,name,google_review_url,latitude,longitude").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return error("Complete onboarding first.", 404);
  if (typeof business.latitude !== "number" || typeof business.longitude !== "number" || !Number.isFinite(business.latitude) || !Number.isFinite(business.longitude) || Math.abs(business.latitude) > 90 || Math.abs(business.longitude) > 180) return error("Add your business location in Settings first.", 409);
  const key = cacheKey(auth.user.id, [business.id, business.latitude, business.longitude, category, radiusKm, limit]);
  let result = await getCachedJson<NearbySearchResponse>(key, auth.user.id); const cached = Boolean(result);
  if (!result) {
    try {
      result = await new GooglePlacesProvider().searchNearbyBusinesses({ latitude: business.latitude, longitude: business.longitude, category, radiusKm, limit });
      await setCachedJson(key, auth.user.id, result, 86400);
    } catch (cause) {
      if (cause instanceof GooglePlacesError) return error(cause.message, cause.status);
      return error("Nearby-business search is unavailable. Please try again later.", 502);
    }
  }
  let myBusiness = { rating: null as number | null, reviewCount: null as number | null, cached: false };
  try {
    const current = await getCurrentGoogleBusinessMetrics(auth.user.id, { id: business.id, name: business.name, googleReviewUrl: business.google_review_url, latitude: business.latitude, longitude: business.longitude });
    myBusiness = { rating: current.metrics.rating, reviewCount: current.metrics.reviewCount, cached: current.cached };
  } catch (cause) {
    if (cause instanceof GooglePlacesError && cause.status === 404) {
      // Competitor results remain useful when the owner's exact Maps listing cannot be matched.
    } else if (cause instanceof GooglePlacesError) return error(cause.message, cause.status);
    else throw cause;
  }
  return json({ success: true, search: { latitude: business.latitude, longitude: business.longitude, category, radiusMeters: radiusKm * 1000, requestedLimit: limit }, metadata: { returnedCount: result.businesses.length, searchedAt: result.searchedAt, provider: result.provider, sourceStatus: result.sourceStatus, isComplete: false, cached }, myBusiness, businesses: result.businesses });
});
