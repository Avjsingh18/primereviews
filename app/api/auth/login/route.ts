import { NextRequest, NextResponse } from "next/server";
import { error } from "@/lib/api";
import { supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import { consumeRateLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return error("Enter your email and password.");
  const limiters = await Promise.all([
    consumeRateLimit(requestRateLimitKey(request, "login", email), 8, 900),
    consumeRateLimit(requestRateLimitKey(request, "login-ip"), 30, 900),
  ]);
  for (const limiter of limiters) {
    if (limiter.unavailable) return rateLimitUnavailableResponse();
    if (!limiter.allowed) return rateLimitResponse(limiter.retryAfter);
  }
  const { data, error: signInError } = await supabasePublic().auth.signInWithPassword({ email, password });
  if (signInError || !data.session) return error("Incorrect email or password.", 401);
  const { data: business } = await supabaseAdmin().from("businesses").select("name").eq("user_id", data.user.id).maybeSingle();
  const response = NextResponse.json({
    businessName: business?.name || data.user.user_metadata.business_name || "",
    onboardingRequired: !business,
  });
  response.cookies.set("prime_reviews_session", data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
  return response;
}
