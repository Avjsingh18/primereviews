import { NextRequest, NextResponse } from "next/server";
import { error, requireUser } from "@/lib/api";
import { safeRoute } from "@/lib/security/http";
import { dateWindow } from "@/lib/security/analytics";
export const GET = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const { start, end } = dateWindow(request);
  const { data: business } = await auth.supabase.from("businesses").select("id").eq("user_id", auth.user.id).maybeSingle(); if (!business) return error("Business not found.", 404);
  const { data, error: queryError } = await auth.supabase.from("review_snapshots").select("snapshot_date,total_reviews").eq("business_id", business.id).gte("snapshot_date", start).lte("snapshot_date", end).order("snapshot_date").limit(366);
  if (queryError) throw new Error("Analytics unavailable");
  return NextResponse.json((data || []).map(x => ({ date: x.snapshot_date, value: x.total_reviews })));
});
