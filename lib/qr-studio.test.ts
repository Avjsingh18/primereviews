import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { printable, renderStudioCard } from "./qr-card";
import { deleteAccountData, type DeletionClient } from "./account-deletion";
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

test("ships a valid ready-made background for every business type", async () => {
  for (const category of Object.keys(qrStudioThemes)) {
    const bytes = fs.readFileSync(path.join(process.cwd(), "lib", "qr-backgrounds", `${category}.webp`));
    const meta = await sharp(bytes).metadata();
    assert.ok(bytes.length <= 80 * 1024, `${category} background must fit the 80 KB photo limit`);
    assert.equal(meta.format, "webp"); assert.equal(meta.width, 720); assert.equal(meta.height, 960);
    const palette = await derivePhotoPalette(bytes, { dark: "#111111", accent: "#222222", light: "#ffffff" });
    assert.match(palette.dark, /^#[0-9a-f]{6}$/);
  }
});

type Row = Record<string, string>;
// A tiny in-memory database with the same relationships as the real one, holding data for two users.
function fakeDatabase(options: { ignoreDeletesIn?: string; authFails?: boolean } = {}) {
  const tables: Record<string, Row[]> = {
    businesses: [{ id: "b1", user_id: "user-1" }, { id: "b2", user_id: "user-2" }],
    qr_codes: [{ id: "q1", business_id: "b1" }, { id: "q2", business_id: "b2" }],
    qr_visit_totals: [{ qr_code_id: "q1" }, { qr_code_id: "q1" }, { qr_code_id: "q2" }],
    qr_scans: [{ qr_code_id: "q1" }, { qr_code_id: "q2" }],
    review_snapshots: [{ business_id: "b1" }, { business_id: "b2" }],
    business_photos: [{ business_id: "b1" }, { business_id: "b2" }],
    qr_studio_designs: [{ business_id: "b1" }, { business_id: "b2" }],
    app_sessions: [{ user_id: "user-1" }, { user_id: "user-1" }, { user_id: "user-2" }],
    app_auth_state: [{ user_id: "user-1" }, { user_id: "user-2" }],
    reviewflow_cache: [{ owner_id: "user-1" }, { owner_id: "user-2" }],
    ai_jobs: [{ owner_id: "user-1" }],
    rate_limit_buckets: [{ bucket_key: "k-user-1" }, { bucket_key: "k-ip-only" }],
  };
  const users = new Set(["user-1", "user-2"]); const events: string[] = [];
  const db: DeletionClient = {
    from: (table) => ({
      select: (_columns, selectOptions) => ({ in: async (column, values) => { const rows = (tables[table] ?? []).filter((row) => values.includes(row[column])); return selectOptions ? { count: rows.length, error: null } : { data: rows, error: null }; } }),
      delete: () => ({ in: async (column, values) => { if (options.ignoreDeletesIn !== table) tables[table] = (tables[table] ?? []).filter((row) => !values.includes(row[column])); events.push(`delete ${table}`); return { error: null }; } }),
    }),
    rpc: async (name) => { events.push(`rpc ${name}`); return { error: null }; },
    storage: { from: () => ({ list: async () => ({ data: [{ name: "user-1_a.webp" }, { name: "user-2_b.webp" }] }), remove: async (paths) => { events.push(`remove ${paths.join(",")}`); return { error: null }; } }) },
    auth: { admin: { deleteUser: async (id) => { events.push("deleteUser"); if (options.authFails) return { error: new Error("boom") }; users.delete(id); return { error: null }; }, getUserById: async (id) => ({ data: { user: users.has(id) ? { id } : null }, error: null }) } },
  };
  return { db, tables, users, events };
}
const deletionOptions = { userId: "user-1", email: "owner@example.com", rateLimitKeys: () => ["k-user-1"] };

test("account deletion removes every row belonging to the user, and only that user's rows", async () => {
  const { db, tables, users, events } = fakeDatabase();
  await deleteAccountData(db, deletionOptions);
  for (const [table, rows] of Object.entries(tables)) {
    const mine = rows.filter((row) => Object.values(row).some((value) => ["user-1", "b1", "q1", "k-user-1"].includes(value)));
    assert.equal(mine.length, 0, `${table} still holds data for the deleted user`);
  }
  assert.equal(tables.businesses.length, 1); assert.equal(tables.qr_codes.length, 1); assert.equal(tables.qr_visit_totals.length, 1); assert.equal(tables.app_sessions.length, 1);
  assert.equal(tables.rate_limit_buckets.length, 1, "keys not tied to the user must stay");
  assert.ok(users.has("user-2") && !users.has("user-1"));
  assert.ok(events.includes("remove user-1_a.webp") && !events.some((event) => event.includes("user-2_b")), "only this user's artwork files are removed");
  assert.ok(events.includes("rpc security_erase_user_traces"));
  assert.equal(events[events.length - 1], "deleteUser", "the sign-in account is removed last");
});

test("account deletion refuses to finish, and keeps the sign-in account, if data is still there", async () => {
  const { db, users } = fakeDatabase({ ignoreDeletesIn: "business_photos" });
  await assert.rejects(() => deleteAccountData(db, deletionOptions), /business_photos/);
  assert.ok(users.has("user-1"), "the account must remain so the user can try again");
});

test("account deletion reports failure when the sign-in account cannot be removed", async () => {
  const { db } = fakeDatabase({ authFails: true });
  await assert.rejects(() => deleteAccountData(db, deletionOptions), /sign-in account/);
});
