import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { HttpError, json, safeRoute } from "@/lib/security/http";

export const GET = safeRoute(async (request: NextRequest) => {
  const secret = process.env.CRON_SECRET || "";
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new HttpError(401, "Unauthorized.");
  const db = supabaseAdmin();
  // The cache has a hard 2,000-row capacity. Batch cleanup stays bounded, even
  // when an attacker fills it, and does not delete a concurrently renewed row.
  for (let batch = 0; batch < 20; batch++) {
    const cutoff = new Date().toISOString();
    // Do not load old base64 payloads: only the object-path scalar is needed.
    const { data: expired, error } = await db.from("reviewflow_cache").select("cache_key,object_path:payload->>objectPath").lt("expires_at", cutoff).limit(100);
    if (error) throw new Error("Maintenance unavailable");
    if (!expired?.length) break;
    const paths = expired.map(row => row.object_path).filter((path): path is string => typeof path === "string" && /^[a-f0-9-]+_[a-f0-9-]+\.webp$/.test(path));
    if (paths.length && (await db.storage.from("qr-artwork").remove(paths)).error) throw new Error("Maintenance unavailable");
    if ((await db.from("reviewflow_cache").delete().in("cache_key", expired.map(row => row.cache_key)).lt("expires_at", cutoff)).error) throw new Error("Maintenance unavailable");
  }
  // Sweep abandoned uploads as well. Generated files never outlive 24h metadata.
  const objects = await db.storage.from("qr-artwork").list("", { limit: 100, sortBy: { column: "created_at", order: "asc" } });
  if (objects.error) throw new Error("Maintenance unavailable");
  const stale = (objects.data || []).filter(x => /^[a-f0-9-]+_[a-f0-9-]+\.webp$/.test(x.name) && x.created_at && Date.parse(x.created_at) < Date.now() - 2 * 86400000).map(x => x.name);
  if (stale.length && (await db.storage.from("qr-artwork").remove(stale)).error) throw new Error("Maintenance unavailable");
  if ((await db.rpc("security_cleanup")).error) throw new Error("Maintenance unavailable");
  return json({ ok: true });
});
