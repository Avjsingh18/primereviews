import { NextRequest, NextResponse } from "next/server";
import { error, requireUser } from "@/lib/api";
import { safeRoute } from "@/lib/security/http";
import { dateWindow } from "@/lib/security/analytics";
import { getCurrentGoogleBusinessMetrics } from "@/lib/google-business-metrics";
import { GooglePlacesError } from "@/lib/google-places";

export const GET = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const { start, end } = dateWindow(request);
  const { data: business } = await auth.supabase.from("businesses").select("id,name,google_review_url,latitude,longitude").eq("user_id", auth.user.id).maybeSingle(); if (!business) return error("Business not found.", 404);
  const snapshots = await Promise.all([end, start].map(date => auth.supabase.from("review_snapshots").select("rating,total_reviews,snapshot_date").eq("business_id", business.id).lte("snapshot_date", date).order("snapshot_date", { ascending: false }).limit(1)));
  if (snapshots.some(x => x.error)) throw new Error("Analytics unavailable");
  const latest = snapshots[0].data?.[0]; const beforeStart = snapshots[1].data?.[0];
  const { data: qr } = await auth.supabase.from("qr_codes").select("id").eq("business_id", business.id).eq("active", true).maybeSingle();
  const visits = qr ? await auth.supabase.from("qr_visit_totals").select("visits").eq("qr_code_id", qr.id).gte("visit_date", start).lte("visit_date", end).limit(366) : { data: [], error: null };
  if (visits.error) throw new Error("Analytics unavailable");
  const count = (visits.data || []).reduce((sum, row) => sum + Number(row.visits), 0);
  let current: { rating: number | null; totalReviews: number | null; cached: boolean } = { rating: latest?.rating ?? null, totalReviews: latest?.total_reviews ?? null, cached: false };
  if (typeof business.latitude === "number" && typeof business.longitude === "number") {
    try {
      const result = await getCurrentGoogleBusinessMetrics(auth.user.id, { id: business.id, name: business.name, googleReviewUrl: business.google_review_url, latitude: business.latitude, longitude: business.longitude });
      current = { rating: result.metrics.rating, totalReviews: result.metrics.reviewCount, cached: result.cached };
    } catch (cause) {
      if (cause instanceof GooglePlacesError && cause.status !== 404) return error(cause.message, cause.status);
    }
  }
  return NextResponse.json({ rating: current.rating, totalReviews: current.totalReviews, newReviews: latest && beforeStart ? latest.total_reviews - beforeStart.total_reviews : null, ratingChange: latest && beforeStart ? Number((latest.rating - beforeStart.rating).toFixed(1)) : null, qrScans: count, googlePlacesCached: current.cached });
});
