import "server-only";
import { z } from "zod";
import { categories, Competitor, haversineDistanceKm, NearbySearchRequest, NearbySearchResponse } from "@/lib/competitor-discovery";

const placesBaseUrl = "https://places.googleapis.com/v1";
const timeoutMs = 15000;
const nearbyFields = "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryType,places.businessStatus";
const textFields = "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.googleMapsUri";

const placeSchema = z.object({
  id: z.string().min(1).max(255),
  displayName: z.object({ text: z.string().trim().min(1).max(300) }).optional(),
  formattedAddress: z.string().trim().max(500).optional(),
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
  rating: z.number().min(0).max(5).optional(),
  userRatingCount: z.number().int().nonnegative().optional(),
  googleMapsUri: z.string().url().max(2048).optional(),
  primaryType: z.string().trim().max(120).optional(),
  businessStatus: z.string().trim().max(120).optional(),
});
const placesResponseSchema = z.object({ places: z.array(placeSchema).max(20).optional() });

export class GooglePlacesError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export type GoogleBusinessMetrics = {
  rating: number; reviewCount: number; googleMapsUrl: string | null; placeId: string; placeName: string; retrievedAt: string;
};

function apiKey() {
  const value = process.env.GOOGLE_MAPS_API_KEY;
  if (!value) throw new GooglePlacesError(503, "Google Places is not configured yet.");
  return value;
}

async function requestPlaces(path: string, fieldMask: string, body: unknown) {
  const key = apiKey();
  let response: Response;
  try {
    response = await fetch(`${placesBaseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fieldMask }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new GooglePlacesError(502, "Google Places is temporarily unavailable. Please try again later.");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new GooglePlacesError(503, "Google Places access is unavailable. Check that Places API (New) is enabled for this key.");
    if (response.status === 429) throw new GooglePlacesError(429, "Google Places request limit has been reached. Please try again later.");
    if (response.status >= 500) throw new GooglePlacesError(502, "Google Places is temporarily unavailable. Please try again later.");
    throw new GooglePlacesError(502, "Google Places could not complete this search.");
  }
  const parsed = placesResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new GooglePlacesError(502, "Google Places returned an invalid response.");
  return parsed.data.places ?? [];
}

function nameKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
function matchScore(expected: string, actual: string) {
  const wanted = nameKey(expected); const received = nameKey(actual);
  if (wanted === received) return 1;
  if (wanted.includes(received) || received.includes(wanted)) return 0.9;
  const a = new Set(wanted.split(" ").filter(Boolean)); const b = new Set(received.split(" ").filter(Boolean));
  let overlap = 0; a.forEach((word) => { if (b.has(word)) overlap += 1; });
  return a.size ? overlap / a.size : 0;
}

export class GooglePlacesProvider {
  async searchNearbyBusinesses(input: NearbySearchRequest): Promise<NearbySearchResponse> {
    const places = await requestPlaces("/places:searchNearby", nearbyFields, { includedTypes: [categories[input.category].googleType], maxResultCount: input.limit, rankPreference: "POPULARITY", locationRestriction: { circle: { center: { latitude: input.latitude, longitude: input.longitude }, radius: input.radiusKm * 1000 } } });
    const retrievedAt = new Date().toISOString(); const seen = new Set<string>();
    const businesses: Competitor[] = places.flatMap((place) => {
      const name = place.displayName?.text;
      if (!name || place.businessStatus === "CLOSED_PERMANENTLY" || !place.location || seen.has(place.id)) return [];
      const distanceKm = haversineDistanceKm(input.latitude, input.longitude, place.location.latitude, place.location.longitude);
      if (distanceKm > input.radiusKm + 0.001) return [];
      seen.add(place.id);
      return [{ id: place.id, name, category: place.primaryType || categories[input.category].label, address: place.formattedAddress ?? null, rating: place.rating ?? null, reviewCount: place.userRatingCount ?? null, ratingSource: "google" as const, latitude: place.location.latitude, longitude: place.location.longitude, distanceKm: Number(distanceKm.toFixed(2)), distanceVerified: true as const, sourceUrl: null, googleMapsUrl: place.googleMapsUri ?? null, verificationStatus: "verified" as const, retrievedAt }];
    }).sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)).slice(0, input.limit);
    return { businesses, provider: "google_places", sourceStatus: "verified", isComplete: false, searchedAt: retrievedAt };
  }

  async findBusinessMetrics(business: { name: string; latitude: number; longitude: number }): Promise<GoogleBusinessMetrics> {
    const places = await requestPlaces("/places:searchText", textFields, { textQuery: business.name, pageSize: 5, rankPreference: "DISTANCE", locationBias: { circle: { center: { latitude: business.latitude, longitude: business.longitude }, radius: 5000 } } });
    const ranked = places.flatMap((place) => {
      const name = place.displayName?.text;
      if (!name || !place.location || place.rating == null || place.userRatingCount == null) return [];
      const distanceKm = haversineDistanceKm(business.latitude, business.longitude, place.location.latitude, place.location.longitude);
      return [{ place, name, distanceKm, score: matchScore(business.name, name) }];
    // Do not accept a merely similar listing. An incorrect rating is worse than no rating.
    }).filter(({ distanceKm, score }) => distanceKm <= 5 && score >= 0.9).sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
    const winner = ranked[0];
    if (!winner) throw new GooglePlacesError(404, "We couldn’t match this business on Google Maps. Check its name and saved location.");
    return { rating: winner.place.rating!, reviewCount: winner.place.userRatingCount!, googleMapsUrl: winner.place.googleMapsUri ?? null, placeId: winner.place.id, placeName: winner.name, retrievedAt: new Date().toISOString() };
  }
}
