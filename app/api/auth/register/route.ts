import { NextRequest, NextResponse } from "next/server";
import { error } from "@/lib/api";
import { supabasePublic } from "@/lib/supabase/server";
import { consumeRateLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";
import { publicRequestLimit } from "@/lib/rate-limit";
import { readJson, safeRoute, siteOrigin, HttpError } from "@/lib/security/http";
import { issueSession, authenticationStarted } from "@/lib/security/session";
import { checkNewPassword } from "@/lib/security/password";
import { legal } from "@/lib/legal-config";

export const POST = safeRoute(async (request: NextRequest) => {
  try {
    const body = await readJson(request);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const ownerName = typeof body?.ownerName === "string" ? body.ownerName.trim() : "";
    const businessName = typeof body?.businessName === "string" ? body.businessName.trim() : "";
    if (!email || email.length>254 || !ownerName || ownerName.length>160 || !businessName || businessName.length>160) return error("Enter a valid name, business name, and email.");
    if (body?.acceptedTerms !== true) return error("Please accept the Terms of Service and Privacy Policy to create an account.");
    await publicRequestLimit(request);
    const limiters = await Promise.all([
      consumeRateLimit(requestRateLimitKey(request, "signup", email), 3, 3600),
      consumeRateLimit(requestRateLimitKey(request, "signup-ip"), 10, 3600),
    ]);
    for (const limiter of limiters) {
      if (limiter.unavailable) return rateLimitUnavailableResponse();
      if (!limiter.allowed) return rateLimitResponse(limiter.retryAfter);
    }

    await checkNewPassword(password);
    const startedAt = await authenticationStarted();
    const { data, error: signUpError } = await supabasePublic().auth.signUp({
      email,
      password,
      options: { data: { owner_name: ownerName, business_name: businessName, terms_accepted_at: new Date().toISOString(), terms_version: legal.termsVersion }, emailRedirectTo: `${siteOrigin(request)}/login` },
    });
    if (signUpError) {
      // Never echo or log provider payloads or credentials.
      if (signUpError.code === "over_email_send_rate_limit") {
        return error("Email delivery is temporarily limited. Please wait before trying again.", 429);
      }
      if (signUpError.code === "email_address_invalid") {
        return error("Please use a valid email address that you can access.");
      }
      return error("We couldn’t create your account. Please try again in a moment.");
    }
    const response = NextResponse.json({ businessName, emailConfirmationRequired: !data.session }, { status: 201 });
    if (data.session) await issueSession(response, data.session, startedAt);
    return response;
  } catch (cause) {
    if (cause instanceof HttpError) throw cause;
    return error("The account service is temporarily unavailable. Please try again in a moment.", 503);
  }
});
