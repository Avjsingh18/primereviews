import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { asCategory, cleanDisplayText, normaliseRenderHash, optimisePhoto, renderStudioCard, stableTagline, validateCustomTagline, verifyQrImage } from "./qr-studio";

test("uses the supplied static categories and a stable default tagline", () => {
  assert.equal(asCategory("plant_nurseries"), "plant_nurseries");
  assert.equal(asCategory("not-a-category"), "other");
  assert.equal(stableTagline("cafes", "1"), stableTagline("cafes", "1"));
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

test("keeps the optimised photo dimensions used by the database contract", async () => {
  const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#875a3e" } }).jpeg().toBuffer();
  const photo = await optimisePhoto(input);
  assert.equal(photo.width, 720);
  assert.equal(photo.height, 960);
});

test("accepts the .png render URL suffix without weakening hash validation", () => {
  const hash = "a".repeat(64);
  assert.equal(normaliseRenderHash(`${hash}.png`), hash);
  assert.equal(normaliseRenderHash(hash), hash);
  assert.equal(normaliseRenderHash("not-a-render"), null);
});
