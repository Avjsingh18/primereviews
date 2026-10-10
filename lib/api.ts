import { NextRequest, NextResponse } from "next/server";
import { supabasePublic, supabaseUser } from "@/lib/supabase/server";
import { loadSession } from "@/lib/security/session";
import { publicRequestLimit, enforceLimit } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/security/http";
import { createHash } from "crypto";
import type { User } from "@supabase/supabase-js";
export { isGoogleReviewUrl } from "@/lib/security/google-url";

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Provider verification of an access token is cached briefly per server instance. Revocation is unaffected: the
// stored session row is still checked on every request, and logout or a password change deletes that row.
const verifiedTokens = new Map<string, { user: User; expires: number }>();
const VERIFY_TTL_MS = 60_000;
async function verifyAccessToken(accessToken: string, userId: string) {
  const key = createHash("sha256").update(accessToken).digest("hex");
  const cached = verifiedTokens.get(key);
  if (cached && cached.expires > Date.now() && cached.user.id === userId) return cached.user;
  const { data, error: authError } = await supabasePublic().auth.getUser(accessToken);
  if (authError || !data.user || data.user.id !== userId) { verifiedTokens.delete(key); return null; }
  verifiedTokens.set(key, { user: data.user, expires: Date.now() + VERIFY_TTL_MS });
  if (verifiedTokens.size > 500) for (const [stored, entry] of verifiedTokens) { if (entry.expires < Date.now() || verifiedTokens.size > 400) verifiedTokens.delete(stored); else break; }
  return data.user;
}

export async function requireUser(request: NextRequest): Promise<{ response: NextResponse } | { supabase: ReturnType<typeof supabaseUser>; user: User; accessToken: string }> {
  await publicRequestLimit(request);
  const session = await loadSession(request);
  if (!session) return { response: error("Please sign in.", 401) };
  // Token verification and the per-account limit are independent, so they run together.
  const [verified, limit] = await Promise.allSettled([
    verifyAccessToken(session.accessToken, session.userId),
    enforceLimit(request, request.method === "GET" ? "account-read" : "account-write", request.method === "GET" ? 120 : 30, 60, session.userId),
  ]);
  if (verified.status === "rejected") throw verified.reason;
  if (!verified.value) return { response: error("Your session has expired. Please sign in again.", 401) };
  if (limit.status === "rejected") throw limit.reason;
  return { supabase: supabaseUser(session.accessToken), user: verified.value, accessToken: session.accessToken };
}

export function publicOrigin(request: NextRequest) {
  return siteOrigin(request);
}

export function trackingUrl(request: NextRequest, slug: string) {
  return `${publicOrigin(request)}/r/${slug}`;
}

export function slugify(value: string) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100) || "business";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
