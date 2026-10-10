import crypto from "node:crypto";
import QRCode from "qrcode";
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

function splitText(value: string, max = 28) {
  if (value.length <= max) return [value];
  const words = value.split(" "); const lines = ["", ""];
  for (const word of words) { const target = lines[0].length <= lines[1].length ? 0 : 1; lines[target] = `${lines[target]} ${word}`.trim(); }
  return lines.filter(Boolean).map((line) => line.length > max + 10 ? `${line.slice(0, max - 1)}…` : line);
}

function pattern(category: QrStudioCategory, accent: string) {
  const leaf = `<path d="M0 26 C22 0 50 0 72 26 C50 50 22 50 0 26Z" fill="none" stroke="${accent}" stroke-width="4"/>`;
  const sparkle = `<path d="M30 0 L38 22 L60 30 L38 38 L30 60 L22 38 L0 30 L22 22Z" fill="${accent}" opacity=".35"/>`;
  return category === "plant_nurseries" ? leaf : category === "cafes" ? `<path d="M0 35 C14 15 34 15 48 35 M16 0 C30 20 30 40 16 60" fill="none" stroke="${accent}" stroke-width="4"/>` : sparkle;
}
function iconSvg(category: QrStudioCategory, index: number, color: string) {
  const symbol = qrStudioThemes[category].icons[index % 6];
  const glyph = symbol === "leaf" || symbol === "sprout" || symbol === "tree" ? "M30 52C10 39 15 13 48 9C52 38 41 50 30 52M30 52V28" : symbol === "cup" || symbol === "pot" ? "M13 21h35v25H13zM48 26h10v12H48M20 12h20" : symbol === "fork" ? "M20 10v20M13 10v13M27 10v13M20 30v22M45 10v42M45 10c10 8 0 18 0 18" : symbol === "cross" ? "M24 10h16v14h14v16H40v14H24V40H10V24h14z" : "M30 8L36 24L52 30L36 36L30 52L24 36L8 30L24 24Z";
  return `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${glyph}" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export type StudioRenderInput = { businessName: string; trackingUrl: string; category: QrStudioCategory; variantIndex: number; tagline: string; bwMode: boolean; photo?: Buffer; photoPalette?: { dark?: string; accent?: string; light?: string } | null };
export async function renderStudioCard(input: StudioRenderInput) {
  const theme = qrStudioThemes[input.category];
  const palette = input.bwMode ? { dark: "#000000", accent: "#000000", light: "#ffffff" } : { dark: input.photoPalette?.dark || theme.dark, accent: input.photoPalette?.accent || theme.accent, light: input.photoPalette?.light || theme.light };
  const name = cleanDisplayText(input.businessName, 60) ?? "Your business";
  const tagline = cleanDisplayText(input.tagline, QR_STUDIO_MAX_TAGLINE_LENGTH) ?? "Tell us about your experience";
  const qr = await QRCode.toBuffer(input.trackingUrl, { width: 620, margin: 4, errorCorrectionLevel: "H", color: { dark: palette.dark, light: palette.light } });
  const layout = input.variantIndex % 6;
  const offset = [0, 70, -60, 110, 35, -90][layout];
  const background = input.bwMode ? sharp({ create: { width: 1200, height: 1800, channels: 4, background: palette.light } }) : input.photo
    ? sharp(input.photo).resize(1200, 1800, { fit: "cover" }).modulate({ brightness: 0.45 }).blur(2)
    : sharp({ create: { width: 1200, height: 1800, channels: 4, background: palette.light } });
  const overlay = `<svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.accent}" stop-opacity="${input.photo ? ".44" : ".92"}"/><stop offset="1" stop-color="${palette.dark}" stop-opacity="${input.photo ? ".48" : ".97"}"/></linearGradient></defs><rect width="1200" height="1800" fill="url(#g)"/>${Array.from({ length: 10 }, (_, index) => `<g transform="translate(${80 + (index % 4) * 310} ${120 + Math.floor(index / 4) * 650}) rotate(${index * 22})" opacity=".32">${pattern(input.category, palette.light)}</g>`).join("")}</svg>`;
  const panelY = 480 + offset;
  const titleLines = splitText(name, 23);
  const taglineLines = splitText(tagline, 34);
  const panel = `<svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg"><rect x="130" y="${panelY}" width="940" height="920" rx="52" fill="${palette.light}"/><rect x="142" y="${panelY + 12}" width="916" height="896" rx="42" fill="none" stroke="${palette.accent}" stroke-width="8"/><g transform="translate(570 ${panelY + 58})">${iconSvg(input.category, Math.floor(input.variantIndex / 2), palette.accent)}</g><text x="600" y="${panelY - 120}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${titleLines.length === 1 ? 74 : 60}" font-weight="700" fill="${input.bwMode ? "#000" : palette.light}">${titleLines.map((line, index) => `<tspan x="600" dy="${index ? 72 : 0}">${escapeXml(line)}</tspan>`).join("")}</text><text x="600" y="${panelY + 800}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${taglineLines.length === 1 ? 38 : 32}" fill="${palette.dark}">${taglineLines.map((line, index) => `<tspan x="600" dy="${index ? 42 : 0}">${escapeXml(line)}</tspan>`).join("")}</text><rect x="440" y="${panelY + 835}" width="320" height="56" rx="28" fill="${palette.accent}"/><text x="600" y="${panelY + 873}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${palette.light}">SCAN &amp; REVIEW</text></svg>`;
  const image = await background.composite([{ input: Buffer.from(overlay), top: 0, left: 0 }, { input: Buffer.from(panel), top: 0, left: 0 }, { input: qr, top: panelY + 140, left: 290 }]).png({ compressionLevel: 9, palette: true }).toBuffer();
  return { image, palette, qr };
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
