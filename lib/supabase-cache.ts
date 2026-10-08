import { supabaseAdmin } from "@/lib/supabase/server";

const table = "reviewflow_cache";

export async function getCachedJson<T>(key: string) {
  const { data, error } = await supabaseAdmin().from(table).select("payload,expires_at").eq("cache_key", key).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin().from(table).delete().eq("cache_key", key);
    return null;
  }
  return data.payload as T;
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const { error } = await supabaseAdmin().from(table).upsert({ cache_key: key, payload: value, expires_at: expiresAt }, { onConflict: "cache_key" });
  if (error) throw error;
}
