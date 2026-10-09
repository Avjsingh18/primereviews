import { supabaseAdmin } from "@/lib/supabase/server";

const table = "reviewflow_cache";

export async function getCachedJson<T>(key: string, owner: string) {
  const { data, error } = await supabaseAdmin().from(table).select("payload,expires_at").eq("cache_key", key).eq("owner_id", owner).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data.payload as T;
}

export async function setCachedJson(key: string, owner: string, value: unknown, ttlSeconds: number) {
  if (Buffer.byteLength(JSON.stringify(value)) > 65536) throw new Error("Cache entry too large");
  const { error } = await supabaseAdmin().rpc("security_store_cache", { p_key: key, p_owner: owner, p_payload: value, p_ttl: Math.min(86400, Math.max(60, ttlSeconds)) });
  if (error) throw error;
}
