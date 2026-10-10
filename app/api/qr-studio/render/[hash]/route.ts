import { NextRequest, NextResponse } from "next/server";
import { requireUser, trackingUrl } from "@/lib/api";
import { asCategory, normaliseRenderHash, renderStudioCard, verifyQrImage } from "@/lib/qr-studio";
import { supabaseAdmin } from "@/lib/supabase/server";
import { safeRoute } from "@/lib/security/http";

export const runtime = "nodejs";
const cache = new Map<string, Buffer>();
function readBytea(value: unknown) { return typeof value === "string" && value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : null; }

export const GET = safeRoute(async (request: NextRequest, context: { params: Promise<{ hash: string }> }) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const { hash: routeHash } = await context.params;
  const hash = normaliseRenderHash(routeHash);
  if (!hash) return new NextResponse("Not found", { status: 404 });
  const { data: business } = await auth.supabase.from("businesses").select("id,name").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return new NextResponse("Not found", { status: 404 });
  const { data: design } = await supabaseAdmin().from("qr_studio_designs").select("*").eq("render_hash", hash).eq("business_id", business.id).eq("is_active", true).maybeSingle();
  if (!design) return new NextResponse("Not found", { status: 404 });
  let image = cache.get(hash);
  if (!image) {
    const { data: qr } = await auth.supabase.from("qr_codes").select("tracking_slug").eq("business_id", business.id).eq("active", true).maybeSingle();
    if (!qr) return new NextResponse("Not found", { status: 404 });
    const { data: photo } = await supabaseAdmin().from("business_photos").select("data,palette,sha256").eq("business_id", business.id).maybeSingle();
    const output = await renderStudioCard({ businessName: business.name, trackingUrl: trackingUrl(request, qr.tracking_slug), category: asCategory(design.category_slug), variantIndex: design.variant_index, tagline: design.tagline_source === "custom" ? design.tagline_custom : design.tagline_id, bwMode: design.bw_mode, photo: readBytea(photo?.data) || undefined, photoPalette: photo?.palette || null });
    await verifyQrImage(output.image, trackingUrl(request, qr.tracking_slug));
    cache.set(hash, output.image); image = output.image;
    if (cache.size > 20) cache.delete(cache.keys().next().value as string);
  }
  return new NextResponse(image!, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=2592000, immutable", "ETag": `\"${hash}\"` } });
});
