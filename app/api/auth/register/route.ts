import { NextRequest, NextResponse } from "next/server";
import { error } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { consumeRateLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const ownerName = typeof body?.ownerName === "string" ? body.ownerName.trim() : "";
    const businessName = typeof body?.businessName === "string" ? body.businessName.trim() : "";
    if (!email || !ownerName || !businessName || password.length < 8) return error("Enter your name, business name, email, and a password with at least 8 characters.");
    const limiters = await Promise.all([
      consumeRateLimit(requestRateLimitKey(request, "signup", email), 3, 3600),
      consumeRateLimit(requestRateLimitKey(request, "signup-ip"), 10, 3600),
    ]);
    for (const limiter of limiters) {
      if (limiter.unavailable) return rateLimitUnavailableResponse();
      if (!limiter.allowed) return rateLimitResponse(limiter.retryAfter);
    }

    const { data, error: signUpError } = await supabaseAdmin().auth.signUp({
      email,
      password,
      options: { data: { owner_name: ownerName, business_name: businessName }, emailRedirectTo: `${new URL(request.url).origin}/login` },
    });
    if (signUpError) {
      // Keep client errors safe, while retaining Supabase's diagnostic details in Vercel logs.
      console.error("Supabase signup failed", { code: signUpError.code, message: signUpError.message, status: signUpError.status });
      if (signUpError.code === "over_email_send_rate_limit") {
        return NextResponse.json({ emailConfirmationRequired: true, email });
      }
      if (signUpError.code === "email_address_invalid") {
        return error("Please use a valid email address that you can access.");
      }
      return error("We couldn’t create your account. Please try again in a moment.");
    }
    const response = NextResponse.json({ businessName, emailConfirmationRequired: !data.session }, { status: 201 });
    if (data.session?.access_token) response.cookies.set("prime_reviews_session", data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
    return response;
  } catch (cause) {
    console.error("Registration route failed", cause);
    return error("The account service is temporarily unavailable. Please try again in a moment.", 503);
  }
}
