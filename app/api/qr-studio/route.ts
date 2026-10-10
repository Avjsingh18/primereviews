import { NextRequest } from "next/server";
import { error, requireUser, trackingUrl } from "@/lib/api";
import { asCategory, configHash, qrStudioEnabled, stableTagline, studioTaglines, type QrStudioCategory, type QrStudioTone, validateCustomTagline } from "@/lib/qr-studio";
import { supabaseAdmin } from "@/lib/supabase/server";
import { enforceLimit } from "@/lib/rate-limit";
import { json, readJson, safeRoute } from "@/lib/security/http";

type DesignRow = { id: string; business_id: string; category_slug: QrStudioCategory; variant_index: number; palette_source: "theme" | "photo"; photo_sha256: string | null; tagline_source: "preset" | "custom"; tagline_id: string | null; tagline_custom: string | null; bw_mode: boolean; seen_variants: number[]; render_hash: string };

async function businessContext(request: NextRequest) {
  const auth = await requireUser(request); if ("response" in auth) return auth;
  const { data: business } = await auth.supabase.from("businesses").select("id,name,category_slug").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return { response: error("Complete onboarding first.", 404) };
  const { data: qr } = await auth.supabase.from("qr_codes").select("tracking_slug").eq("business_id", business.id).eq("active", true).maybeSingle();
  if (!qr) return { response: error("Create your QR code first.", 409) };
  return { ...auth, business: { id: business.id, name: business.name, category: asCategory(business.category_slug) }, tracking: trackingUrl(request, qr.tracking_slug) };
}

function present(design: DesignRow, businessName: string, tracking: string) {
  const tagline = design.tagline_source === "custom" ? design.tagline_custom : studioTaglines(design.category_slug, "friendly").find((value) => value === design.tagline_id) || design.tagline_id;
  return { id: design.id, category: design.category_slug, variantIndex: design.variant_index, tagline: tagline || "Tell us about your experience", taglineSource: design.tagline_source, bwMode: design.bw_mode, renderUrl: `/api/qr-studio/render/${design.render_hash}.png`, businessName, trackingUrl: tracking, seenVariants: design.seen_variants || [] };
}

async function activeDesign(businessId: string) {
  const { data, error: queryError } = await supabaseAdmin().from("qr_studio_designs").select("*").eq("business_id", businessId).eq("is_active", true).maybeSingle();
  if (queryError) throw queryError;
  return data as DesignRow | null;
}

export const GET = safeRoute(async (request) => {
  if (!qrStudioEnabled()) return error("QR Studio is not enabled.", 404);
  const context = await businessContext(request); if ("response" in context) return context.response;
  const design = await activeDesign(context.business.id);
  return json({ design: design ? present(design, context.business.name, context.tracking) : null, category: context.business.category });
});

export const POST = safeRoute(async (request) => {
  if (!qrStudioEnabled()) return error("QR Studio is not enabled.", 404);
  const context = await businessContext(request); if ("response" in context) return context.response;
  await enforceLimit(request, "qr-studio-design", 60, 3600, context.user.id);
  const body = await readJson(request, 4096);
  const existing = await activeDesign(context.business.id);
  const category = asCategory(body.category ?? existing?.category_slug ?? context.business.category);
  const mode = body.mode === "shuffle" ? "shuffle" : body.mode === "select" ? "select" : "new";
  const picked = Number.isInteger(body.variantIndex) && Number(body.variantIndex) >= 0 && Number(body.variantIndex) < 12 ? Number(body.variantIndex) : 0;
  const seen = Array.isArray(existing?.seen_variants) ? existing!.seen_variants.filter((value): value is number => Number.isInteger(value) && value >= 0 && value < 12) : [];
  const variantIndex = mode === "shuffle" ? Array.from({ length: 12 }, (_, index) => (index + (existing?.variant_index ?? -1) + 1) % 12).find((index) => !seen.includes(index)) ?? ((existing?.variant_index ?? 0) + 1) % 12 : mode === "select" ? picked : existing?.variant_index ?? 0;
  const taglineSource = body.taglineSource === "custom" ? "custom" as const : "preset" as const;
  const tone: QrStudioTone = body.tone === "funny" || body.tone === "professional" ? body.tone : "friendly";
  const custom = taglineSource === "custom" ? validateCustomTagline(body.tagline) : null;
  if (custom && "error" in custom) return error(custom.error || "Use a valid custom tagline.");
  const tagline = taglineSource === "custom" ? custom!.text : (typeof body.tagline === "string" && studioTaglines(category, tone).includes(body.tagline) ? body.tagline : existing?.tagline_id || stableTagline(category, context.business.id));
  const { data: photo } = await supabaseAdmin().from("business_photos").select("sha256").eq("business_id", context.business.id).maybeSingle();
  const payload = { businessId: context.business.id, category, variantIndex, paletteSource: photo ? "photo" : "theme", photoSha256: photo?.sha256 ?? null, taglineSource, tagline, bwMode: body.bwMode === true, seenVariants: [...seen, variantIndex].slice(-12) };
  const renderHash = configHash({ ...payload, businessName: context.business.name, tracking: context.tracking });
  if (existing) await supabaseAdmin().from("qr_studio_designs").update({ category_slug: category, variant_index: variantIndex, palette_source: payload.paletteSource, photo_sha256: payload.photoSha256, tagline_source: taglineSource, tagline_id: taglineSource === "preset" ? tagline : null, tagline_custom: taglineSource === "custom" ? tagline : null, bw_mode: payload.bwMode, seen_variants: payload.seenVariants, render_hash: renderHash, updated_at: new Date().toISOString() }).eq("id", existing.id);
  else await supabaseAdmin().from("qr_studio_designs").insert({ business_id: context.business.id, category_slug: category, variant_index: variantIndex, palette_source: payload.paletteSource, photo_sha256: payload.photoSha256, tagline_source: taglineSource, tagline_id: taglineSource === "preset" ? tagline : null, tagline_custom: taglineSource === "custom" ? tagline : null, bw_mode: payload.bwMode, seen_variants: payload.seenVariants, render_hash: renderHash });
  const saved = await activeDesign(context.business.id); if (!saved) throw new Error("Missing QR Studio design.");
  return json({ design: present(saved, context.business.name, context.tracking) });
});
