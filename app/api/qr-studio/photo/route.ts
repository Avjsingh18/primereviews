import { NextRequest } from "next/server";
import { error, requireUser } from "@/lib/api";
import { QR_STUDIO_MAX_REQUEST_BYTES, QR_STUDIO_MAX_UPLOAD_BYTES, optimisePhoto } from "@/lib/qr-studio";
import { enforceLimit } from "@/lib/rate-limit";
import { HttpError, json, siteOrigin } from "@/lib/security/http";
import { supabaseAdmin } from "@/lib/supabase/server";

function assertFormOrigin(request: NextRequest) {
  if (request.headers.get("origin") !== siteOrigin(request) || request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "This request is not allowed.");
}
async function boundedFormData(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Upload a photo.");
  const parts: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > QR_STUDIO_MAX_REQUEST_BYTES) { await reader.cancel(); throw new HttpError(413, "Photo uploads must be 5 MB or smaller."); }
    parts.push(part.value);
  }
  return new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type") || "" }, body: Buffer.concat(parts) }).formData();
}
async function context(request: NextRequest) {
  const auth = await requireUser(request); if ("response" in auth) return auth;
  const { data: business } = await auth.supabase.from("businesses").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (!business) return { response: error("Complete onboarding first.", 404) };
  return { ...auth, businessId: business.id };
}
function failure(cause: unknown) { return error(cause instanceof HttpError ? cause.message : cause instanceof Error ? cause.message : "The photo could not be processed.", cause instanceof HttpError ? cause.status : 400); }

export const POST = async (request: NextRequest) => {
  try {
    assertFormOrigin(request);
    if (Number(request.headers.get("content-length")) > QR_STUDIO_MAX_REQUEST_BYTES) throw new HttpError(413, "Photo uploads must be 5 MB or smaller.");
    const loaded = await context(request); if ("response" in loaded) return loaded.response;
    await enforceLimit(request, "qr-studio-photo", 5, 86400, loaded.businessId);
    const form = await boundedFormData(request);
    if (form.get("consent") !== "true") throw new HttpError(400, "Confirm that you have the right to use this photo.");
    const file = form.get("photo");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > QR_STUDIO_MAX_UPLOAD_BYTES) throw new HttpError(400, "Upload a JPG, PNG or WebP photo up to 5 MB.");
    const processed = await optimisePhoto(Buffer.from(await file.arrayBuffer()));
    const record = { business_id: loaded.businessId, mime: "image/webp", data: `\\x${processed.bytes.toString("hex")}`, bytes: processed.bytes.length, width: processed.width, height: processed.height, sha256: processed.sha256, palette: processed.palette, updated_at: new Date().toISOString() };
    const { error: storeError } = await supabaseAdmin().from("business_photos").upsert(record, { onConflict: "business_id" });
    if (storeError) throw storeError;
    return json({ bytes: processed.bytes.length, palette: processed.palette });
  } catch (cause) { return failure(cause); }
};

export const DELETE = async (request: NextRequest) => {
  try {
    assertFormOrigin(request);
    const loaded = await context(request); if ("response" in loaded) return loaded.response;
    const { error: deleteError } = await supabaseAdmin().from("business_photos").delete().eq("business_id", loaded.businessId);
    if (deleteError) throw deleteError;
    return json({ removed: true });
  } catch (cause) { return failure(cause); }
};
