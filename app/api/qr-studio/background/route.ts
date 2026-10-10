import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { error, requireUser } from "@/lib/api";
import { asCategory, derivePhotoPalette, qrStudioEnabled, qrStudioThemes } from "@/lib/qr-studio";
import { enforceLimit } from "@/lib/rate-limit";
import { json, safeRoute } from "@/lib/security/http";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Applies the ready-made background for the business's own type. The file name comes from the validated category
// whitelist, never from the request, and the image is stored exactly like an uploaded photo (one per business, 80 KB cap).
export const POST = safeRoute(async (request: NextRequest) => {
  if (!qrStudioEnabled()) return error("QR Studio is not enabled.", 404);
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  await enforceLimit(request, "qr-studio-background", 20, 86400, auth.user.id);
  const { data: business } = await auth.supabase.from("businesses").select("id,category_slug").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return error("Complete onboarding first.", 404);
  const category = asCategory(business.category_slug);
  let bytes: Buffer;
  try { bytes = await fs.readFile(path.join(process.cwd(), "lib", "qr-backgrounds", `${category}.webp`)); } catch { return error("This background is not available right now.", 503); }
  const meta = await sharp(bytes).metadata();
  if (bytes.length > 80 * 1024 || meta.format !== "webp" || meta.width !== 720 || meta.height !== 960) return error("This background is not available right now.", 503);
  const theme = qrStudioThemes[category];
  const palette = await derivePhotoPalette(bytes, { dark: theme.dark, accent: theme.accent, light: theme.light });
  const { error: storeError } = await supabaseAdmin().from("business_photos").upsert({ business_id: business.id, mime: "image/webp", data: `\\x${bytes.toString("hex")}`, bytes: bytes.length, width: 720, height: 960, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), palette, updated_at: new Date().toISOString() }, { onConflict: "business_id" });
  if (storeError) return error("The background could not be saved. Please try again.", 503);
  return json({ bytes: bytes.length, palette, source: "background" });
});
