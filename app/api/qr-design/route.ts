import { NextRequest } from "next/server";
import { error, requireUser, trackingUrl } from "@/lib/api";
import { generateQrDesign, normalizeQrTheme, QrArtworkError } from "@/lib/qr-design";
import { getCachedJson, setCachedJson } from "@/lib/supabase-cache";
import { enforceLimit } from "@/lib/rate-limit";
import { aiCacheKey, aiConfiguration, finishAi, reserveAi } from "@/lib/security/ai";
import { presentArtwork, storeArtwork, StoredArtwork } from "@/lib/security/artwork";
import { json, readJson, safeRoute } from "@/lib/security/http";
import { qrLegacyArtworkEnabled } from "@/lib/qr-studio";
export const runtime = "nodejs";

export const POST = safeRoute(async (request: NextRequest) => {
  if (!qrLegacyArtworkEnabled()) return error("Legacy AI QR artwork is disabled.", 404);
  aiConfiguration("qr");
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const theme = normalizeQrTheme((await readJson(request)).theme);
  if (!theme) return error("Describe your theme in 8 to 600 characters.");
  await enforceLimit(request, "qr-design-user", 3, 3600, auth.user.id);
  await enforceLimit(request, "qr-design-ip", 10, 3600);
  const { data: business } = await auth.supabase.from("businesses").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return error("Complete onboarding first.", 404);
  const { data: qr } = await auth.supabase.from("qr_codes").select("tracking_slug").eq("business_id", business.id).eq("active", true).maybeSingle();
  if (!qr) return error("Create your QR code first.", 409);
  const target = trackingUrl(request, qr.tracking_slug);
  const key = aiCacheKey("qr", auth.user.id, [theme.toLowerCase(), target]);
  const cached = await getCachedJson<StoredArtwork>(key, auth.user.id);
  if (cached) return json({ design: await presentArtwork(auth.user.id, cached, target), cached: true });
  const reservation = await reserveAi(key, auth.user.id, "qr");
  try {
    const design = await generateQrDesign({ theme, trackingUrl: target, apiKey: reservation.apiKey, model: reservation.model, signal: AbortSignal.timeout(120000) });
    const stored = await storeArtwork(auth.user.id, design);
    await setCachedJson(key, auth.user.id, stored, 86400);
    await finishAi(key, reservation.reservation, "complete");
    return json({ design: await presentArtwork(auth.user.id, stored, target), cached: false });
  } catch (caught) {
    await finishAi(key, reservation.reservation, "failed");
    if (caught instanceof QrArtworkError) {
      console.warn("QR artwork provider request failed", { status: caught.status, code: caught.providerCode ?? "unknown" });
      return error(caught.message, 502);
    }
    return error("The artwork service is unavailable. Please try again later.", 502);
  }
});
