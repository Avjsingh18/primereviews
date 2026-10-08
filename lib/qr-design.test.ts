import assert from "node:assert/strict";
import test from "node:test";
import { createReliableQrDataUrl, normalizeQrTheme, qrArtworkPrompt } from "./qr-design";

test("accepts a concise restaurant theme and rejects invalid input", () => {
  assert.equal(normalizeQrTheme("  Warm  terracotta  cafe with plants  "), "Warm terracotta cafe with plants");
  assert.equal(normalizeQrTheme("short"), null);
  assert.equal(normalizeQrTheme("x".repeat(601)), null);
});

test("locks the artwork prompt to a safe QR-compatible background", () => {
  const prompt = qrArtworkPrompt("modern Japanese ramen bar with indigo tile");
  assert.match(prompt, /Do not draw a QR code/);
  assert.match(prompt, /central 70 percent/);
  assert.match(prompt, /modern Japanese ramen bar/);
});

test("creates a high-correction QR data URL", async () => {
  const qr = await createReliableQrDataUrl("https://reviewflow.example/r/cafe");
  assert.match(qr, /^data:image\/png;base64,/);
});
