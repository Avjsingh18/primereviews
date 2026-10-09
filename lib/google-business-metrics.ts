import "server-only";
import { createHash } from "crypto";
import { GoogleBusinessMetrics, GooglePlacesProvider } from "@/lib/google-places";
import { getCachedJson, setCachedJson } from "@/lib/supabase-cache";

const oneDaySeconds = 24 * 60 * 60;

export type GoogleBusinessIdentity = { id: string; name: string; googleReviewUrl: string; latitude: number; longitude: number };

function cacheKey(ownerId: string, business: GoogleBusinessIdentity) {
  const input = [ownerId, business.id, business.name, business.googleReviewUrl, business.latitude, business.longitude];
  return `google-metrics:v1:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

export async function getCurrentGoogleBusinessMetrics(ownerId: string, business: GoogleBusinessIdentity) {
  const key = cacheKey(ownerId, business);
  const cached = await getCachedJson<GoogleBusinessMetrics>(key, ownerId);
  if (cached) return { metrics: cached, cached: true };
  const metrics = await new GooglePlacesProvider().findBusinessMetrics(business);
  await setCachedJson(key, ownerId, metrics, oneDaySeconds);
  return { metrics, cached: false };
}
