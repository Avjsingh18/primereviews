import { NextRequest, NextResponse } from "next/server";
import { error, requireUser } from "@/lib/api";
import { safeRoute } from "@/lib/security/http";
import { dateWindow } from "@/lib/security/analytics";

export const GET = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const { start, end } = dateWindow(request);
  const { data: business } = await auth.supabase.from("businesses").select("id").eq("user_id", auth.user.id).maybeSingle(); if (!business) return error("Business not found.", 404);
  const snapshots = await Promise.all([end, start].map(date => auth.supabase.from("review_snapshots").select("rating,total_reviews,snapshot_date").eq("business_id", business.id).lte("snapshot_date", date).order("snapshot_date", { ascending: false }).limit(1)));
  if (snapshots.some(x => x.error)) throw new Error("Analytics unavailable");
  const latest = snapshots[0].data?.[0]; const beforeStart = snapshots[1].data?.[0];
  const { data: qr } = await auth.supabase.from("qr_codes").select("id").eq("business_id", business.id).eq("active", true).maybeSingle();
  const visits = qr ? await auth.supabase.from("qr_visit_totals").select("visits").eq("qr_code_id", qr.id).gte("visit_date", start).lte("visit_date", end).limit(366) : { data: [], error: null };
  if (visits.error) throw new Error("Analytics unavailable");
  const count = (visits.data || []).reduce((sum, row) => sum + Number(row.visits), 0);
  return NextResponse.json({ rating: latest?.rating ?? null, totalReviews: latest?.total_reviews ?? null, newReviews: latest && beforeStart ? latest.total_reviews - beforeStart.total_reviews : null, ratingChange: latest && beforeStart ? Number((latest.rating - beforeStart.rating).toFixed(1)) : null, qrScans: count });
});
