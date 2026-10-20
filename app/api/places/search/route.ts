import { NextRequest, NextResponse } from "next/server";
import { error, requireUser } from "@/lib/api";
import { enforceLimit } from "@/lib/rate-limit";
import { readJson, safeRoute } from "@/lib/security/http";
import { GooglePlacesError, GooglePlacesProvider } from "@/lib/google-places";
import { isPlaceId } from "@/lib/places-id";

// Lets a signed-in owner find their business on Google by name and area (or confirm the place ID found in their review link).
export const POST = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const body = await readJson(request, 1024);
  const placeId = body?.placeId; const query = typeof body?.query === "string" ? body.query.trim().replace(/\s+/g, " ") : "";
  if (placeId === undefined && (query.length < 3 || query.length > 120)) return error("Enter your business name and area, for example “Sharma Dental Clinic Noida”.");
  if (placeId !== undefined && !isPlaceId(placeId)) return error("That business link is not valid.");
  await enforceLimit(request, "places-search", 30, 3600, auth.user.id);
  const provider = new GooglePlacesProvider();
  try {
    if (isPlaceId(placeId)) {
      const place = await provider.getPlace(placeId);
      if (place.closed) return error("That business is permanently closed on Google Maps.", 404);
      return NextResponse.json({ places: [{ placeId: place.placeId, name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude }] });
    }
    return NextResponse.json({ places: await provider.searchBusinesses(query) });
  } catch (cause) {
    if (cause instanceof GooglePlacesError) return error(cause.message, cause.status === 404 ? 404 : cause.status === 429 ? 429 : 502);
    throw cause;
  }
});
