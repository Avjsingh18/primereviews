import { NextRequest } from "next/server";
import { error, requireUser, trackingUrl } from "@/lib/api";
import { QR_STUDIO_DESIGN_COUNT, QR_STUDIO_RENDER_VERSION, asCategory, configHash, qrStudioEnabled, stableTagline, studioTaglines, type QrStudioCategory, type QrStudioTone, validateCustomTagline } from "@/lib/qr-studio";
import { supabaseAdmin } from "@/lib/supabase/server";
import { enforceLimit } from "@/lib/rate-limit";
import { json, readJson, safeRoute } from "@/lib/security/http";

type DesignRow = { id: string; business_id: string; category_slug: QrStudioCategory; variant_index: number; palette_source: "theme" | "photo"; photo_sha256: string | null; tagline_source: "preset" | "custom"; tagline_id: string | null; tagline_custom: string | null; bw_mode: boolean; seen_variants: number[]; render_hash: string };
type Context = { business: { id: string; name: string; category: QrStudioCategory }; tracking: string; user: { id: string } };
const TONES: QrStudioTone[] = ["funny", "friendly", "professional"];

async function businessContext(request: NextRequest) {
  const auth = await requireUser(request); if ("response" in auth) return auth;
  const { data: business } = await auth.supabase.from("businesses").select("id,name,category_slug").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return { response: error("Complete onboarding first.", 404) };
  const { data: qr } = await auth.supabase.from("qr_codes").select("tracking_slug").eq("business_id", business.id).eq("active", true).maybeSingle();
  if (!qr) return { response: error("Create your QR code first.", 409) };
  return { ...auth, business: { id: business.id, name: business.name, category: asCategory(business.category_slug) }, tracking: trackingUrl(request, qr.tracking_slug) };
}

function present(design: DesignRow, businessName: string, tracking: string) {
  const tagline = design.tagline_source === "custom" ? design.tagline_custom : design.tagline_id;
  return { id: design.id, category: design.category_slug, variantIndex: design.variant_index, tagline: tagline || "Tell us about your experience", taglineSource: design.tagline_source, bwMode: design.bw_mode, renderUrl: `/api/qr-studio/render/${design.render_hash}.jpg`, businessName, trackingUrl: tracking, seenVariants: design.seen_variants || [] };
}

async function activeDesign(businessId: string) {
  const { data, error: queryError } = await supabaseAdmin().from("qr_studio_designs").select("*").eq("business_id", businessId).eq("is_active", true).maybeSingle();
  if (queryError) throw queryError;
  return data as DesignRow | null;
}

function hashFor(design: { category: QrStudioCategory; variantIndex: number; photoSha256: string | null; taglineSource: string; tagline: string; bwMode: boolean }, context: Context) {
  return configHash({ ...design, businessId: context.business.id, businessName: context.business.name, tracking: context.tracking, renderVersion: QR_STUDIO_RENDER_VERSION });
}

// The category always comes from the business type saved in the database. The first design is created automatically.
async function applyDesign(context: Context, body: Record<string, unknown>): Promise<{ design?: DesignRow; problem?: string }> {
  const existing = await activeDesign(context.business.id);
  const category = context.business.category;
  const current = existing && existing.variant_index < QR_STUDIO_DESIGN_COUNT ? existing.variant_index : 0;
  const validSeen = (Array.isArray(existing?.seen_variants) ? existing!.seen_variants : []).filter((value): value is number => Number.isInteger(value) && value >= 0 && value < QR_STUDIO_DESIGN_COUNT);
  let seen = validSeen.length ? validSeen : [current];
  let variantIndex = current;
  if (body.mode === "shuffle") {
    const others = Array.from({ length: QR_STUDIO_DESIGN_COUNT }, (_, index) => index).filter((index) => index !== current);
    const fresh = others.filter((index) => !seen.includes(index));
    if (!fresh.length) seen = [current];
    const pool = fresh.length ? fresh : others;
    variantIndex = pool[Math.floor(Math.random() * pool.length)];
  }
  seen = [...new Set([...seen, variantIndex])];
  const taglineSource = body.taglineSource === "custom" || body.taglineSource === "preset" ? body.taglineSource : existing?.tagline_source ?? "preset";
  const tone: QrStudioTone = body.tone === "funny" || body.tone === "professional" ? body.tone : "friendly";
  const custom = taglineSource === "custom" ? validateCustomTagline(body.tagline ?? existing?.tagline_custom) : null;
  if (custom && "error" in custom) return { problem: custom.error || "Use a valid custom tagline." };
  const keepsPreset = existing?.tagline_source === "preset" && existing.tagline_id && TONES.some((value) => studioTaglines(category, value).includes(existing.tagline_id!));
  const tagline = custom ? custom.text : (typeof body.tagline === "string" && studioTaglines(category, tone).includes(body.tagline) ? body.tagline : keepsPreset ? existing!.tagline_id! : stableTagline(category, context.business.id));
  const { data: photo } = await supabaseAdmin().from("business_photos").select("sha256").eq("business_id", context.business.id).maybeSingle();
  const bwMode = typeof body.bwMode === "boolean" ? body.bwMode : existing?.bw_mode ?? false;
  const fields = { category_slug: category, variant_index: variantIndex, palette_source: photo ? "photo" : "theme", photo_sha256: photo?.sha256 ?? null, tagline_source: taglineSource, tagline_id: taglineSource === "preset" ? tagline : null, tagline_custom: taglineSource === "custom" ? tagline : null, bw_mode: bwMode, seen_variants: seen, render_hash: hashFor({ category, variantIndex, photoSha256: photo?.sha256 ?? null, taglineSource, tagline, bwMode }, context) };
  const write = existing ? await supabaseAdmin().from("qr_studio_designs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", existing.id) : await supabaseAdmin().from("qr_studio_designs").insert({ business_id: context.business.id, ...fields });
  if (write.error) throw write.error;
  const saved = await activeDesign(context.business.id); if (!saved) throw new Error("Missing QR Studio design.");
  return { design: saved };
}

export const GET = safeRoute(async (request) => {
  if (!qrStudioEnabled()) return error("QR Studio is not enabled.", 404);
  const context = await businessContext(request); if ("response" in context) return context.response;
  let design = await activeDesign(context.business.id);
  const stale = !design || design.category_slug !== context.business.category || design.variant_index >= QR_STUDIO_DESIGN_COUNT || design.render_hash !== hashFor({ category: design.category_slug, variantIndex: design.variant_index, photoSha256: design.photo_sha256, taglineSource: design.tagline_source, tagline: (design.tagline_source === "custom" ? design.tagline_custom : design.tagline_id) || "", bwMode: design.bw_mode }, context);
  if (stale) { await enforceLimit(request, "qr-studio-design", 60, 3600, context.user.id); const result = await applyDesign(context, {}); if (!result.design) return error(result.problem ?? "Could not create your QR design."); design = result.design; }
  return json({ design: present(design!, context.business.name, context.tracking), category: context.business.category });
});

export const POST = safeRoute(async (request) => {
  if (!qrStudioEnabled()) return error("QR Studio is not enabled.", 404);
  const context = await businessContext(request); if ("response" in context) return context.response;
  await enforceLimit(request, "qr-studio-design", 60, 3600, context.user.id);
  const result = await applyDesign(context, await readJson(request, 4096));
  if (!result.design) return error(result.problem ?? "Could not save the QR design.");
  return json({ design: present(result.design, context.business.name, context.tracking) });
});
