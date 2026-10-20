import { NextRequest, NextResponse } from "next/server";
import { error, requireUser } from "@/lib/api";
import { safeRoute } from "@/lib/security/http";
import { dateWindow } from "@/lib/security/analytics";
import { getCurrentGoogleBusinessMetrics } from "@/lib/google-business-metrics";
import { GooglePlacesError } from "@/lib/google-places";
import { supabaseAdmin } from "@/lib/supabase/server";
import { dailyScanSeries, dailySnapshotSeries } from "@/lib/analytics-series";

export const GET = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const { start, end } = dateWindow(request);
  const { data: business } = await auth.supabase.from("businesses").select("id,name,google_review_url,latitude,longitude,google_place_id").eq("user_id", auth.user.id).maybeSingle(); if (!business) return error("Business not found.", 404);
  const [{ data: snapshots, error: snapshotError }, { data: qr }] = await Promise.all([
    auth.supabase.from("review_snapshots").select("rating,total_reviews,snapshot_date").eq("business_id", business.id).lte("snapshot_date", end).order("snapshot_date", { ascending: false }).limit(367),
    auth.supabase.from("qr_codes").select("id").eq("business_id", business.id).eq("active", true).maybeSingle(),
  ]);
  if (snapshotError) throw new Error("Analytics unavailable");
  const beforeStart = (snapshots || []).find((snapshot) => snapshot.snapshot_date <= start) ?? null;
  const latestSnapshot = snapshots?.[0] ?? null;
  const scanRows = qr ? await auth.supabase.from("qr_visit_totals").select("visit_date,visits").eq("qr_code_id", qr.id).gte("visit_date", start).lte("visit_date", end).order("visit_date").limit(366) : { data: [], error: null };
  if (scanRows.error) throw new Error("Analytics unavailable");
  const count = (scanRows.data || []).reduce((sum, row) => sum + Number(row.visits), 0);
  // A Places match can occasionally be unavailable (for example, after a Maps listing rename).
  // Keep the last confirmed snapshot on screen instead of blanking all reputation metrics.
  let current: { rating: number | null; totalReviews: number | null; cached: boolean } = { rating: latestSnapshot?.rating ?? null, totalReviews: latestSnapshot?.total_reviews ?? null, cached: false };
  if (typeof business.latitude === "number" && typeof business.longitude === "number") {
    try {
      const result = await getCurrentGoogleBusinessMetrics(auth.user.id, { id: business.id, name: business.name, googleReviewUrl: business.google_review_url, latitude: business.latitude, longitude: business.longitude, placeId: business.google_place_id });
      current = { rating: result.metrics.rating, totalReviews: result.metrics.reviewCount, cached: result.cached };
      if (!result.cached) {
        const { error: saveSnapshotError } = await supabaseAdmin().from("review_snapshots").upsert({ business_id: business.id, rating: result.metrics.rating, total_reviews: result.metrics.reviewCount, snapshot_date: new Date().toISOString().slice(0, 10), source: "google_places" }, { onConflict: "business_id,snapshot_date" });
        if (saveSnapshotError) throw new Error("Analytics unavailable");
      }
    } catch (cause) {
      if (cause instanceof GooglePlacesError && cause.status !== 404) return error(cause.message, cause.status);
    }
  }
  return NextResponse.json({
    rating: current.rating,
    totalReviews: current.totalReviews,
    newReviews: current.totalReviews != null && beforeStart ? current.totalReviews - beforeStart.total_reviews : null,
    ratingChange: current.rating != null && beforeStart ? Number((current.rating - beforeStart.rating).toFixed(1)) : null,
    qrScans: count,
    rangeStart: start,
    rangeEnd: end,
    ratings: dailySnapshotSeries(snapshots || [], start, end, "rating"),
    reviews: dailySnapshotSeries(snapshots || [], start, end, "total_reviews"),
    scans: dailyScanSeries(scanRows.data || [], start, end),
  });
});
