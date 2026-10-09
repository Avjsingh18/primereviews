import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { publicRequestLimit } from "@/lib/rate-limit";
import { isGoogleReviewUrl } from "@/lib/security/google-url";
import { safeRoute } from "@/lib/security/http";

export const GET = safeRoute(async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(slug)) return new NextResponse("QR code not found.", { status: 404 });
  // Quotas apply before any slug lookup, including unknown slugs.
  await publicRequestLimit(request);
  const supabase = supabaseAdmin();
  const { data: qr } = await supabase.from("qr_codes").select("id,business_id,active").eq("tracking_slug", slug).eq("active", true).maybeSingle();
  if (!qr) return new NextResponse("QR code not found.", { status: 404 });
  const { data: business } = await supabase.from("businesses").select("google_review_url").eq("id", qr.business_id).maybeSingle();
  if (!business || !isGoogleReviewUrl(business.google_review_url)) return new NextResponse("Review destination unavailable.", { status: 404 });
  // Visits are approximate, not unique people or completed reviews. Never store IP/UA.
  const preview = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slack|discord|telegram/i.test(request.headers.get("user-agent") || "") || request.headers.has("purpose") || request.headers.has("sec-purpose");
  if (request.method !== "HEAD" && !preview) {
    try { await supabase.rpc("security_record_visit", { p_qr: qr.id }); } catch { /* Analytics must not break a valid redirect. */ }
  }
  return NextResponse.redirect(business.google_review_url, { status: 302 });
});
export const HEAD = GET;
