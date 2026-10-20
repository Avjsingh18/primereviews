import "server-only";
import { createHash } from "crypto";
import { GoogleBusinessMetrics, GooglePlacesProvider } from "@/lib/google-places";
import { getCachedJson, setCachedJson } from "@/lib/supabase-cache";

const oneDaySeconds = 24 * 60 * 60;

export type GoogleBusinessIdentity = { id: string; name: string; googleReviewUrl: string; latitude: number; longitude: number; placeId?: string | null };

function cacheKey(ownerId: string, business: GoogleBusinessIdentity) {
  const input = [ownerId, business.id, business.name, business.googleReviewUrl, business.latitude, business.longitude, business.placeId ?? null];
  // v3 adds the Google place ID to the key; earlier versions matched by name and location only.
  return `google-metrics:v3:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

export async function getCurrentGoogleBusinessMetrics(ownerId: string, business: GoogleBusinessIdentity) {
  const key = cacheKey(ownerId, business);
  const cached = await getCachedJson<GoogleBusinessMetrics>(key, ownerId);
  if (cached) return { metrics: cached, cached: true };
  const provider = new GooglePlacesProvider();
  // A saved place ID is exact. Without one (older accounts) fall back to the strict name-and-location match.
  const metrics = business.placeId ? await provider.getBusinessMetricsByPlaceId(business.placeId) : await provider.findBusinessMetrics(business);
  await setCachedJson(key, ownerId, metrics, oneDaySeconds);
  return { metrics, cached: false };
}
