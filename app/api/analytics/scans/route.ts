import { NextRequest, NextResponse } from "next/server";
import { error, requireUser } from "@/lib/api";
import { safeRoute } from "@/lib/security/http";
import { dateWindow } from "@/lib/security/analytics";
import { dailyScanSeries } from "@/lib/analytics-series";
export const GET = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const { start, end } = dateWindow(request);
  const { data: business } = await auth.supabase.from("businesses").select("id").eq("user_id", auth.user.id).maybeSingle(); if (!business) return error("Business not found.", 404);
  const { data: qr } = await auth.supabase.from("qr_codes").select("id").eq("business_id", business.id).eq("active", true).maybeSingle(); if (!qr) return NextResponse.json(dailyScanSeries([], start, end));
  const { data, error: queryError } = await auth.supabase.from("qr_visit_totals").select("visit_date,visits").eq("qr_code_id", qr.id).gte("visit_date", start).lte("visit_date", end).order("visit_date").limit(366);
  if (queryError) throw new Error("Analytics unavailable");
  return NextResponse.json(dailyScanSeries(data || [], start, end));
});
