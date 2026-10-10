import crypto from "node:crypto";
import sharp from "sharp";
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";
import taglinesJson from "@/data/qr_taglines.json";

export const QR_STUDIO_FLAG = "QR_STUDIO_V2";
export const QR_STUDIO_LEGACY_FLAG = "QR_LEGACY_ARTWORK_ENABLED";
export const QR_STUDIO_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const QR_STUDIO_MAX_REQUEST_BYTES = 6 * 1024 * 1024;
export const QR_STUDIO_MAX_TAGLINE_LENGTH = 60;

export type QrStudioCategory =
  | "cafes" | "restaurants" | "hotels" | "pg" | "salons" | "clinics"
  | "coaching_centres" | "plant_nurseries" | "day_care" | "preschools" | "gyms" | "other";
export type QrStudioTone = "funny" | "friendly" | "professional";

type Theme = { label: string; dark: string; accent: string; light: string; icons: string[] };
export const qrStudioThemes: Record<QrStudioCategory, Theme> = {
  cafes: { label: "Cafés", dark: "#3B2418", accent: "#C68B59", light: "#F6EBDD", icons: ["cup", "bean", "croissant", "press", "pot", "steam"] },
  restaurants: { label: "Restaurants", dark: "#962318", accent: "#E0701C", light: "#FCF6E8", icons: ["bowl", "cloche", "fork", "chilli", "tandoor", "thali"] },
  hotels: { label: "Hotels", dark: "#14213D", accent: "#C9A227", light: "#FAF6EC", icons: ["key", "bed", "bell", "building", "case", "palm"] },
  pg: { label: "PG", dark: "#0F766E", accent: "#F59E0B", light: "#F4FAF8", icons: ["house", "key", "bed", "wifi", "lamp", "bunk"] },
  salons: { label: "Salons", dark: "#6B2C5E", accent: "#E8A0BF", light: "#FDF3F7", icons: ["scissors", "comb", "mirror", "dryer", "nail", "lipstick"] },
  clinics: { label: "Clinics", dark: "#0B5FA5", accent: "#19A7A8", light: "#F2F8FC", icons: ["cross", "heart", "scope", "tooth", "shield", "pill"] },
  coaching_centres: { label: "Coaching centres", dark: "#3730A3", accent: "#FBBF24", light: "#F7F7FF", icons: ["book", "pencil", "cap", "trophy", "bulb", "atom"] },
  plant_nurseries: { label: "Plant nurseries", dark: "#1E5434", accent: "#8BC34A", light: "#EEF4E2", icons: ["leaf", "pot", "sprout", "cactus", "can", "tree"] },
  day_care: { label: "Day care", dark: "#0369A1", accent: "#FDBA74", light: "#FFF8EC", icons: ["teddy", "bottle", "rattle", "blocks", "duck", "moon"] },
  preschools: { label: "Preschools", dark: "#1D4ED8", accent: "#FACC15", light: "#FFFBEA", icons: ["abc", "crayon", "pencil", "bus", "rainbow", "plane"] },
  gyms: { label: "Gyms", dark: "#111827", accent: "#A3E635", light: "#F5F7EF", icons: ["dumbbell", "kettle", "flame", "bolt", "pulse", "medal"] },
  other: { label: "Other", dark: "#1F2937", accent: "#F59E0B", light: "#FAFAF7", icons: ["star", "like", "chat", "heart", "pin", "sparkle"] },
};

type TaglineData = { categories: Partial<Record<QrStudioCategory, { label: string } & Record<QrStudioTone, string[]>>> };
const suppliedTaglines = taglinesJson as TaglineData;

export function qrStudioEnabled() { return process.env[QR_STUDIO_FLAG] !== "false"; }
export function qrLegacyArtworkEnabled() { return process.env[QR_STUDIO_LEGACY_FLAG] === "true"; }
export function asCategory(value: unknown): QrStudioCategory {
  return typeof value === "string" && value in qrStudioThemes ? value as QrStudioCategory : "other";
}
export function studioTaglines(category: QrStudioCategory, tone: QrStudioTone) {
  return suppliedTaglines.categories[category]?.[tone] ?? ["Tell us about your experience"];
}
export function stableTagline(category: QrStudioCategory, businessId: string) {
  const choices = studioTaglines(category, "friendly");
  const position = crypto.createHash("sha256").update(businessId).digest().readUInt32BE(0) % choices.length;
  return choices[position];
}
export function cleanDisplayText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, "").replace(/[\p{Extended_Pictographic}]/gu, "").replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= max ? text : null;
}
export function validateCustomTagline(value: unknown) {
  const text = cleanDisplayText(value, QR_STUDIO_MAX_TAGLINE_LENGTH);
  if (!text) return { error: "Use 1 to 60 visible characters." } as const;
  if (/https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b\+?\d[\d\s()-]{7,}\d\b/i.test(text)) return { error: "Links, email addresses and phone numbers are not allowed." } as const;
  if (/\b(free|discount|offer|coupon|cashback|reward|gift|voucher|prize|win)\b.{0,32}\b(review|rating|star|feedback)\b|\b(review|rating|star|feedback)\b.{0,32}\b(free|discount|offer|coupon|cashback|reward|gift|voucher|prize|win)\b/i.test(text)) return { error: "Incentives linked to reviews are not allowed by Google policy." } as const;
  if (/\b(fuck|shit|bhenchod|madarchod|chutiya)\b/i.test(text)) return { error: "Please remove profanity from the tagline." } as const;
  return { text } as const;
}
export function configHash(value: unknown) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function escapeXml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character); }
export function normaliseRenderHash(value: string) {
  const hash = value.endsWith(".png") ? value.slice(0, -4) : value;
  return /^[a-f0-9]{64}$/i.test(hash) ? hash : null;
}

export async function verifyQrImage(image: Buffer, expected: string) {
  for (const width of [1200, 600, 350]) {
    const decoded = await sharp(image).resize({ width }).grayscale().raw().toBuffer({ resolveWithObject: true });
    const source = new RGBLuminanceSource(new Uint8ClampedArray(decoded.data), decoded.info.width, decoded.info.height);
    const result = new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(source)));
    if (result.getText() !== expected) throw new Error(`QR verification failed at ${width}px.`);
  }
}

export async function optimisePhoto(file: Buffer) {
  const source = sharp(file, { animated: false, limitInputPixels: 25_000_000 }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format || "") || metadata.width < 600 || metadata.height < 600 || metadata.width * metadata.height > 25_000_000 || (metadata.pages && metadata.pages > 1)) throw new Error("Use a single JPG, PNG or WebP photo that is at least 600 px on each side.");
  let output = await source.resize(720, 960, { fit: "cover" }).toColourspace("srgb").webp({ quality: 65 }).toBuffer();
  for (let quality = 60; output.length > 45 * 1024 && quality >= 30; quality -= 5) output = await sharp(output).webp({ quality }).toBuffer();
  if (output.length > 80 * 1024) throw new Error("This photo cannot be optimised below 80 KB. Please choose a simpler photo.");
  const optimised = await sharp(output).metadata();
  if (optimised.width !== 720 || optimised.height !== 960) throw new Error("The photo could not be processed.");
  const { data } = await sharp(output).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  const [red, green, blue] = data; const dark = `#${[red, green, blue].map((part) => Math.max(0, Math.round(part * .25)).toString(16).padStart(2, "0")).join("")}`;
  const accent = `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  return { bytes: output, width: optimised.width, height: optimised.height, sha256: crypto.createHash("sha256").update(output).digest("hex"), palette: { dark, accent, light: "#FCFCF8" } };
}
