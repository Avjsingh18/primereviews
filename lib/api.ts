import { NextRequest, NextResponse } from "next/server";
import { supabasePublic, supabaseUser } from "@/lib/supabase/server";
import { loadSession } from "@/lib/security/session";
import { publicRequestLimit, enforceLimit } from "@/lib/rate-limit";
import { siteOrigin } from "@/lib/security/http";
import type { User } from "@supabase/supabase-js";
export { isGoogleReviewUrl } from "@/lib/security/google-url";

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser(request: NextRequest): Promise<{ response: NextResponse } | { supabase: ReturnType<typeof supabaseUser>; user: User; accessToken: string }> {
  await publicRequestLimit(request);
  const session = await loadSession(request);
  if (!session) return { response: error("Please sign in.", 401) };
  const { data, error: authError } = await supabasePublic().auth.getUser(session.accessToken);
  if (authError || !data.user || data.user.id !== session.userId) return { response: error("Your session has expired. Please sign in again.", 401) };
  await enforceLimit(request, request.method === "GET" ? "account-read" : "account-write", request.method === "GET" ? 120 : 30, 60, data.user.id);
  return { supabase: supabaseUser(session.accessToken), user: data.user, accessToken: session.accessToken };
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
