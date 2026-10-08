import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

type LimitResult = { allowed: boolean; retryAfter: number; unavailable?: boolean };

function clientAddress(request: NextRequest) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function bucketHash(value: string) {
  const salt = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "prime-reviews-rate-limit";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function requestRateLimitKey(request: NextRequest, scope: string, identity = "") {
  return bucketHash(`${scope}:${identity}:${clientAddress(request)}`);
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

export function rateLimitUnavailableResponse() {
  return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again shortly." }, { status: 503 });
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<LimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  try {
    const supabase = supabaseAdmin();
    const { data: current, error: readError } = await supabase.from("rate_limit_buckets").select("window_started_at,request_count").eq("bucket_key", key).maybeSingle();
    if (readError) throw readError;
    const started = current ? new Date(current.window_started_at).getTime() : now;
    if (!current || now - started >= windowMs) {
      const { error } = await supabase.from("rate_limit_buckets").upsert({ bucket_key: key, window_started_at: new Date(now).toISOString(), request_count: 1, updated_at: new Date(now).toISOString() }, { onConflict: "bucket_key" });
      if (error) throw error;
      return { allowed: true, retryAfter: windowSeconds };
    }
    const count = Number(current.request_count) || 0;
    const retryAfter = Math.max(1, Math.ceil((started + windowMs - now) / 1000));
    if (count >= limit) return { allowed: false, retryAfter };
    const { error } = await supabase.from("rate_limit_buckets").update({ request_count: count + 1, updated_at: new Date(now).toISOString() }).eq("bucket_key", key).eq("window_started_at", new Date(started).toISOString());
    if (error) throw error;
    return { allowed: true, retryAfter };
  } catch (cause) {
    console.error("Rate limiter unavailable", { message: cause instanceof Error ? cause.message : "unknown" });
    return { allowed: false, retryAfter: 60, unavailable: true };
  }
}
