import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const boundedFetch: typeof fetch = (input, init) => fetch(input, { ...init, redirect: "error", signal: AbortSignal.any([AbortSignal.timeout(15000), ...(init?.signal ? [init.signal] : [])]) });

function assertCloudMode() {
  if (process.env.REVIEWFLOW_LOCAL_BACKEND === "true") throw new Error("Cloud access is disabled in local mode.");
}

let adminClient: SupabaseClient | undefined;

// The service-role client only runs table, RPC and admin calls, which hold no per-user session state, so it is reused.
export function supabaseAdmin() {
  assertCloudMode();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  adminClient ??= createClient(url, serviceRoleKey, { global: { fetch: boundedFetch }, auth: { autoRefreshToken: false, persistSession: false } });
  return adminClient;
}

export function supabasePublic() {
  assertCloudMode();
  if (!url) throw new Error("Supabase is not configured.");
  // Never shared: sign-in and refresh calls keep session state on the client that made them.
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", { global: { fetch: boundedFetch }, auth: { autoRefreshToken: false, persistSession: false } });
}

export function supabaseUser(accessToken: string) {
  assertCloudMode();
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Supabase is not configured.");
  const proof = process.env.DATABASE_API_SECRET;
  if (!proof || !/^[a-f0-9]{64}$/i.test(proof)) throw new Error("Database request protection is not configured.");
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { global: { fetch: boundedFetch, headers: { Authorization: `Bearer ${accessToken}`, "x-reviewflow-server-proof": proof } }, auth: { persistSession: false, autoRefreshToken: false } });
}
