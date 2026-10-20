import { NextRequest, NextResponse } from "next/server";
import { error, isGoogleReviewUrl, requireUser, slugify, trackingUrl } from "@/lib/api";
import { readJson, safeRoute } from "@/lib/security/http";
import { isBusinessType, type BusinessType } from "@/lib/business-types";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GooglePlacesError, GooglePlacesProvider, type PlaceDetails } from "@/lib/google-places";
import { isPlaceId, placeIdFromReviewUrl } from "@/lib/places-id";

type Location = { latitude: number; longitude: number };
type Place = { id: string; name: string; address: string | null };
type Business = { id: string; name: string; slug: string; google_review_url: string; latitude: number | null; longitude: number | null; category: BusinessType; place: Place | null };
type BusinessBase = Omit<Business, "latitude" | "longitude" | "category" | "place">;

function validInput(body: unknown) {
  const input = body as { name?: unknown; googleReviewUrl?: unknown; latitude?: unknown; longitude?: unknown; category?: unknown; placeId?: unknown } | null;
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const googleReviewUrl = typeof input?.googleReviewUrl === "string" ? input.googleReviewUrl.trim() : "";
  if (!isGoogleReviewUrl(googleReviewUrl)) return null;

  const hasLatitude = Object.hasOwn(input ?? {}, "latitude");
  const hasLongitude = Object.hasOwn(input ?? {}, "longitude");
  if (hasLatitude !== hasLongitude) return null;
  let location: Location | undefined;
  if (hasLatitude && hasLongitude) {
    const latitude = typeof input?.latitude === "number" ? input.latitude : Number.NaN;
    const longitude = typeof input?.longitude === "number" ? input.longitude : Number.NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    location = { latitude, longitude };
  }
  if (input?.placeId !== undefined && !isPlaceId(input.placeId)) return null;
  const placeId = isPlaceId(input?.placeId) ? input.placeId : undefined;
  if (input?.category !== undefined && !isBusinessType(input.category)) return null;
  const category = isBusinessType(input?.category) ? input.category : undefined;
  return name && name.length <= 160 ? { name, googleReviewUrl, location, category, placeId } : null;
}

async function responseForBusiness(request: NextRequest, supabase: ReturnType<typeof import("@/lib/supabase/server").supabaseAdmin>, business: Business) {
  const { data: qr } = await supabase.from("qr_codes").select("tracking_slug").eq("business_id", business.id).eq("active", true).maybeSingle();
  return NextResponse.json({
    id: business.id, name: business.name, slug: business.slug, googleReviewUrl: business.google_review_url,
    latitude: business.latitude, longitude: business.longitude, category: business.category, place: business.place,
    trackingUrl: qr ? trackingUrl(request, qr.tracking_slug) : null,
  });
}

// businesses.category_slug is not in the browser roles' column grants, so the server writes it after ownership is verified.
async function saveCategory(userId: string, category: BusinessType) {
  const { error: categoryError } = await supabaseAdmin().from("businesses").update({ category_slug: category }).eq("user_id", userId);
  if (categoryError) throw categoryError;
}

const businessFields = "id,name,slug,google_review_url";

async function withLocation(supabase: ReturnType<typeof import("@/lib/supabase/server").supabaseAdmin>, business: BusinessBase): Promise<Business> {
  const { data, error: locationError } = await supabase.from("businesses").select("latitude,longitude,category_slug,google_place_id,google_place_name,google_place_address").eq("id", business.id).maybeSingle();
  const place = !locationError && data?.google_place_id && data.google_place_name ? { id: data.google_place_id as string, name: data.google_place_name as string, address: (data.google_place_address as string | null) ?? null } : null;
  return { ...business, latitude: locationError ? null : data?.latitude ?? null, longitude: locationError ? null : data?.longitude ?? null, category: isBusinessType(data?.category_slug) ? data.category_slug : "other", place };
}

// The place is looked up on Google by the server, so its name, address and coordinates cannot be forged by the browser.
// If the review link itself names a place, the chosen business must be that place.
async function resolvePlace(input: { googleReviewUrl: string; placeId?: string }): Promise<{ response: NextResponse } | { place: PlaceDetails } | null> {
  if (!input.placeId) return null;
  const linked = placeIdFromReviewUrl(input.googleReviewUrl);
  if (linked && linked !== input.placeId) return { response: error("That business doesn’t match your Google review link. Pick the business your review link belongs to.", 422) };
  try {
    const place = await new GooglePlacesProvider().getPlace(input.placeId);
    if (place.closed) return { response: error("That business is permanently closed on Google Maps.", 422) };
    return { place };
  } catch (cause) {
    if (cause instanceof GooglePlacesError) return { response: error(cause.message, cause.status === 404 ? 404 : cause.status === 429 ? 429 : 502) };
    throw cause;
  }
}

async function savePlace(userId: string, place: PlaceDetails) {
  const { error: placeError } = await supabaseAdmin().from("businesses").update({ google_place_id: place.placeId, google_place_name: place.name.slice(0, 300), google_place_address: place.address?.slice(0, 500) ?? null }).eq("user_id", userId);
  if (placeError) throw placeError;
}

export const GET = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const { data: business } = await auth.supabase.from("businesses").select(businessFields).eq("user_id", auth.user.id).maybeSingle();
  if (!business) return error("Complete onboarding to create your business.", 404);
  return responseForBusiness(request, auth.supabase, await withLocation(auth.supabase, business as BusinessBase));
});

export const POST = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const input = validInput(await readJson(request)); if (!input) return error("Enter a valid business name, Google review URL, and location.");
  const { data: existing } = await auth.supabase.from("businesses").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (existing) return error("This account already has a business.", 409);
  const resolved = await resolvePlace(input); if (resolved && "response" in resolved) return resolved.response;
  const location = resolved ? { latitude: resolved.place.latitude, longitude: resolved.place.longitude } : input.location;
  const { data: business, error: insertError } = await auth.supabase.from("businesses").insert({
    user_id: auth.user.id, name: input.name, google_review_url: input.googleReviewUrl, slug: slugify(input.name),
    ...(location ? { ...location, location_updated_at: new Date().toISOString() } : {}),
  }).select(businessFields).single();
  if (insertError || !business) return error("We couldn’t save your business.");
  if (input.category) await saveCategory(auth.user.id, input.category);
  if (resolved) await savePlace(auth.user.id, resolved.place);
  return responseForBusiness(request, auth.supabase, await withLocation(auth.supabase, business as BusinessBase));
});

export const PUT = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const input = validInput(await readJson(request)); if (!input) return error("Enter a valid business name, Google review URL, and location.");
  const resolved = await resolvePlace(input); if (resolved && "response" in resolved) return resolved.response;
  const location = resolved ? { latitude: resolved.place.latitude, longitude: resolved.place.longitude } : input.location;
  const { data: business, error: updateError } = await auth.supabase.from("businesses").update({
    name: input.name, google_review_url: input.googleReviewUrl, updated_at: new Date().toISOString(),
    ...(location ? { ...location, location_updated_at: new Date().toISOString() } : {}),
  }).eq("user_id", auth.user.id).select(businessFields).single();
  if (updateError || !business) return error("We couldn’t update your business.", 404);
  if (input.category) await saveCategory(auth.user.id, input.category);
  if (resolved) await savePlace(auth.user.id, resolved.place);
  return responseForBusiness(request, auth.supabase, await withLocation(auth.supabase, business as BusinessBase));
});
