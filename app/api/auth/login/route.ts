import { NextRequest, NextResponse } from "next/server";
import { error } from "@/lib/api";
import { supabaseUser, supabasePublic } from "@/lib/supabase/server";
import { consumeRateLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";
import { publicRequestLimit } from "@/lib/rate-limit";
import { readJson, safeRoute, json } from "@/lib/security/http";
import { issueSession, authenticationStarted } from "@/lib/security/session";

export const POST = safeRoute(async (request: NextRequest) => {
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || email.length>254 || !password || password.length>256) return error("Enter your email and password.");
  await publicRequestLimit(request);
  const limiters = await Promise.all([
    consumeRateLimit(requestRateLimitKey(request, "login", email), 8, 900),
    consumeRateLimit(requestRateLimitKey(request, "login-ip"), 30, 900),
  ]);
  for (const limiter of limiters) {
    if (limiter.unavailable) return rateLimitUnavailableResponse();
    if (!limiter.allowed) return rateLimitResponse(limiter.retryAfter);
  }
  const startedAt = await authenticationStarted();
  const { data, error: signInError } = await supabasePublic().auth.signInWithPassword({ email, password });
  if (signInError || !data.session) return error("Incorrect email or password.", 401);
  const { data: business } = await supabaseUser(data.session.access_token).from("businesses").select("name").eq("user_id", data.user.id).maybeSingle();
  const response = json({
    businessName: business?.name || data.user.user_metadata.business_name || "",
    onboardingRequired: !business,
  });
  await issueSession(response, data.session, startedAt);
  return response;
});
