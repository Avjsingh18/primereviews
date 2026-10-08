import { NextRequest, NextResponse } from "next/server";
import { error, requireUser, trackingUrl } from "@/lib/api";
import { generateQrDesign, normalizeQrTheme, QrDesign } from "@/lib/qr-design";
import { getCachedJson, redis, setCachedJson } from "@/lib/redis-cache";

export const runtime = "nodejs";

const pending = new Map<string, Promise<QrDesign>>();
const cacheTtlMs = Math.max(60, Number(process.env.QR_DESIGN_CACHE_TTL_SECONDS || 86400)) * 1000;

async function productionTrackingUrl(request: NextRequest) {
  const auth = await requireUser(request); if ("response" in auth) return { response: auth.response };
  const { data: business } = await auth.supabase.from("businesses").select("id,slug").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return { response: error("Complete onboarding before creating a QR design.", 404) };
  let { data: qr } = await auth.supabase.from("qr_codes").select("tracking_slug").eq("business_id", business.id).eq("active", true).maybeSingle();
  if (!qr) {
    const { data } = await auth.supabase.from("qr_codes").insert({ business_id: business.id, tracking_slug: business.slug, active: true }).select("tracking_slug").single();
    qr = data;
  }
  if (!qr) return { response: error("We couldn’t create your QR code.", 502) };
  return { trackingUrl: trackingUrl(request, qr.tracking_slug), identity: auth.user.id };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { theme?: unknown } | null;
  const theme = normalizeQrTheme(body?.theme);
  if (!theme) return error("Describe your restaurant theme in 8 to 600 characters.");
  if (!process.env.OPENAI_API_KEY) return error("AI QR design is not configured yet. Add OPENAI_API_KEY on the server to enable it.", 503);
  try { await redis(); } catch { return error("AI QR cache is unavailable. Start Redis locally or configure REDIS_URL.", 503); }

  const target = await productionTrackingUrl(request);
  if ("response" in target) return target.response;
  const key = `${theme.toLowerCase()}:${target.trackingUrl}`;
  const cached = await getCachedJson<QrDesign>(`reviewflow:qr-design:${key}`);
  if (cached) return NextResponse.json({ design: cached, cached: true });
  const existing = pending.get(key);
  if (existing) return NextResponse.json({ design: await existing, cached: false });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(10_000, Number(process.env.QR_DESIGN_TIMEOUT_MS || 120000)));
  const work = generateQrDesign({ theme, trackingUrl: target.trackingUrl, apiKey: process.env.OPENAI_API_KEY, model: process.env.QR_DESIGN_IMAGE_MODEL || "gpt-image-2.5-flare", signal: controller.signal });
  pending.set(key, work);
  try {
    const design = await work;
    await setCachedJson(`reviewflow:qr-design:${key}`, design, Math.floor(cacheTtlMs / 1000));
    return NextResponse.json({ design, cached: false });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The artwork service is unavailable.";
    return error(message, message.includes("blocked") ? 422 : 502);
  } finally {
    clearTimeout(timeout);
    pending.delete(key);
  }
}
