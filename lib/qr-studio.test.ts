import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { printable, renderStudioCard } from "./qr-card";
import { asCategory, cleanDisplayText, normaliseRenderHash, derivePhotoPalette, optimisePhoto, qrStudioThemes, stableTagline, studioTaglines, validateCustomTagline, verifyQrImage } from "./qr-studio";

test("uses the supplied static categories and a stable default tagline", () => {
  assert.equal(asCategory("plant_nurseries"), "plant_nurseries");
  assert.equal(asCategory("not-a-category"), "other");
  assert.equal(stableTagline("cafes", "1"), stableTagline("cafes", "1"));
});

test("provides at least 50 curated taglines for every QR Studio category", () => {
  for (const category of (Object.keys(qrStudioThemes) as Array<keyof typeof qrStudioThemes>).filter((value) => value !== "other")) {
    const total = studioTaglines(category, "funny").length + studioTaglines(category, "friendly").length + studioTaglines(category, "professional").length;
    assert.ok(total >= 50, `${category} must have at least 50 taglines`);
  }
});

test("sanitises custom taglines and blocks review incentives", () => {
  assert.equal(cleanDisplayText("  Hello\u0000  world  ", 60), "Hello world");
  assert.match(validateCustomTagline("Get a free gift for your review").error || "", /Incentives/);
  assert.match(validateCustomTagline("Visit https://example.com").error || "", /Links/);
  assert.equal(validateCustomTagline("Thanks for visiting us").text, "Thanks for visiting us");
});

test("renders and decodes a high-correction QR Studio card", async () => {
  const url = "https://reviewflow.example/r/test-code";
  const result = await renderStudioCard({ businessName: "R. Serto Nursery", trackingUrl: url, category: "plant_nurseries", variantIndex: 3, tagline: "Help our little nursery grow", bwMode: false });
  assert.ok(result.image.length > 10_000);
  await verifyQrImage(result.image, url);
});

test("offers four distinct designs for every business type and keeps each scannable", async () => {
  const url = "https://reviewflow.example/r/variation-test";
  for (const category of Object.keys(qrStudioThemes) as Array<keyof typeof qrStudioThemes>) {
    const renders = await Promise.all(Array.from({ length: 4 }, (_, variantIndex) => renderStudioCard({ businessName: "Desi Tadka", trackingUrl: url, category, variantIndex, tagline: "Loved the food? Tell us!", bwMode: false })));
    assert.equal(new Set(renders.map((result) => crypto.createHash("sha256").update(result.image).digest("hex"))).size, 4, `${category} designs must differ`);
    for (const result of renders) await verifyQrImage(result.image, url);
  }
});

test("renders JPEG output and a scannable black-and-white card", async () => {
  const url = "https://reviewflow.example/r/bw";
  const result = await renderStudioCard({ businessName: "Desi Tadka", trackingUrl: url, category: "restaurants", variantIndex: 0, tagline: "Loved the food? Tell us!", bwMode: true });
  assert.equal((await sharp(result.image).metadata()).format, "jpeg");
  await verifyQrImage(result.image, url);
});

test("keeps the optimised photo dimensions used by the database contract", async () => {
  const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#875a3e" } }).jpeg().toBuffer();
  const photo = await optimisePhoto(input);
  assert.equal(photo.width, 720);
  assert.equal(photo.height, 960);
});

test("accepts the .jpg and .png render URL suffixes without weakening hash validation", () => {
  const hash = "a".repeat(64);
  assert.equal(normaliseRenderHash(`${hash}.png`), hash);
  assert.equal(normaliseRenderHash(`${hash}.jpg`), hash);
  assert.equal(normaliseRenderHash(hash), hash);
  assert.equal(normaliseRenderHash("not-a-render"), null);
});

test("every curated tagline can be drawn with the bundled card font", () => {
  for (const category of Object.keys(qrStudioThemes) as Array<keyof typeof qrStudioThemes>) for (const tone of ["funny", "friendly", "professional"] as const) for (const line of studioTaglines(category, tone)) assert.equal(printable(line, 500), line, `${category}/${tone}: "${line}" has characters the card font cannot draw`);
});

test("renders long business names without clipping and keeps the QR scannable", async () => {
  const url = "https://reviewflow.example/r/long-name";
  const result = await renderStudioCard({ businessName: "The Grind House Coffee Roasters & Bakery", trackingUrl: url, category: "cafes", variantIndex: 2, tagline: "Loved your coffee? Tell the world", bwMode: false });
  await verifyQrImage(result.image, url);
});

test("keeps the photo's colour instead of turning the QR black on dark photos", async () => {
  const night = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#1a0f08" } }).composite([{ input: Buffer.from('<svg width="200" height="200"><circle cx="60" cy="60" r="40" fill="#e8962e"/><circle cx="150" cy="140" r="30" fill="#c8741c"/></svg>') }]).png().toBuffer();
  const fallback = { dark: "#111111", accent: "#222222", light: "#ffffff" };
  const palette = await derivePhotoPalette(night, fallback);
  assert.notDeepEqual(palette, fallback);
  const [red, green, blue] = [1, 3, 5].map((index) => parseInt(palette.dark.slice(index, index + 2), 16));
  assert.ok(red > green && green >= blue && red >= 60, `dark colour ${palette.dark} should be a deep warm tone, not black`);
  const grey = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#777777" } }).png().toBuffer();
  assert.deepEqual(await derivePhotoPalette(grey, fallback), fallback);
});
