import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createReliableQrDataUrl, QrDesign } from "@/lib/qr-design";

export type StoredArtwork = { theme: string; objectPath: string; generatedAt: string };
export async function storeArtwork(owner: string, design: QrDesign): Promise<StoredArtwork> {
  const encoded = design.backgroundDataUrl.match(/^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/)?.[1];
  if (!encoded || encoded.length > 2796204) throw new Error("Invalid artwork size");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > 2097152 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error("Invalid artwork format");
  const objectPath = `${owner}_${randomUUID()}.webp`;
  const { error } = await supabaseAdmin().storage.from("qr-artwork").upload(objectPath, bytes, { contentType: "image/webp", upsert: false });
  if (error) throw new Error("Artwork storage unavailable");
  return { theme: design.theme, objectPath, generatedAt: design.generatedAt };
}
export async function presentArtwork(owner: string, artwork: StoredArtwork, target: string): Promise<QrDesign> {
  if (!artwork.objectPath.startsWith(`${owner}_`) || !/^[a-f0-9-]+_[a-f0-9-]+\.webp$/.test(artwork.objectPath)) throw new Error("Invalid artwork ownership");
  const { data, error } = await supabaseAdmin().storage.from("qr-artwork").createSignedUrl(artwork.objectPath, 300);
  if (error || !data) throw new Error("Artwork unavailable");
  return { theme: artwork.theme, generatedAt: artwork.generatedAt, backgroundDataUrl: data.signedUrl, qrDataUrl: await createReliableQrDataUrl(target) };
}
