import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { HttpError } from "@/lib/security/http";

type LimitResult = { allowed: boolean; retryAfter: number; unavailable?: boolean };

export function clientAddress(request: NextRequest) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function privateHash(value: string) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, "Request protection is not configured.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function requestRateLimitKey(request: NextRequest, scope: string, identity = "") {
  return privateHash(`${scope}:${identity || clientAddress(request)}`);
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

export function rateLimitUnavailableResponse() {
  return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again shortly." }, { status: 503 });
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<LimitResult> {
  try {
    const { data, error } = await supabaseAdmin().rpc("security_consume_rate", { p_key: key, p_limit: limit, p_seconds: windowSeconds });
    if (error || !data || typeof data.allowed !== "boolean") throw new Error();
    return { allowed: data.allowed, retryAfter: Math.max(1, Number(data.retry_after) || windowSeconds) };
  } catch {
    return { allowed: false, retryAfter: 60, unavailable: true };
  }
}

export async function enforceLimit(request: NextRequest, scope: string, limit: number, seconds: number, identity = "") {
  const result = await consumeRateLimit(requestRateLimitKey(request, scope, identity), limit, seconds);
  if (result.unavailable) throw new HttpError(503, "Request protection is temporarily unavailable.");
  if (!result.allowed) throw new HttpError(429, "Too many requests. Please try again later.");
}
export async function publicRequestLimit(request: NextRequest) {
  await Promise.all([enforceLimit(request, "public-api-global", 1500, 60, "all"), enforceLimit(request, "public-api-ip", 120, 60)]);
}
