import { NextRequest } from "next/server";
import { error } from "@/lib/api";
import { supabasePublic } from "@/lib/supabase/server";
import { consumeRateLimit, publicRequestLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";
import { json, readJson, safeRoute, siteOrigin } from "@/lib/security/http";

// Sends a password-reset email. The answer is the same whether or not an account exists, so this cannot be used to find out who has one.
export const POST = safeRoute(async (request: NextRequest) => {
  const body = await readJson(request, 2048);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Enter a valid email address.");
  await publicRequestLimit(request);
  const limiters = await Promise.all([
    consumeRateLimit(requestRateLimitKey(request, "forgot-password", email), 3, 3600),
    consumeRateLimit(requestRateLimitKey(request, "forgot-password-ip"), 10, 3600),
  ]);
  for (const limiter of limiters) {
    if (limiter.unavailable) return rateLimitUnavailableResponse();
    if (!limiter.allowed) return rateLimitResponse(limiter.retryAfter);
  }
  const { error: resetError } = await supabasePublic().auth.resetPasswordForEmail(email, { redirectTo: `${siteOrigin(request)}/reset-password` });
  if (resetError?.code === "over_email_send_rate_limit") return error("Email delivery is temporarily limited. Please wait a few minutes and try again.", 429);
  return json({ ok: true });
});
