import { NextRequest } from "next/server";
import { error, requireUser } from "@/lib/api";
import { supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import { json, readJson, safeRoute } from "@/lib/security/http";
import { clearSessionCookie } from "@/lib/security/session";
import { consumeRateLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";
import { deleteAccountData } from "@/lib/account-deletion";

// Permanently deletes the signed-in user's account and all of their data after re-checking their password.
export const POST = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;
  const limiter = await consumeRateLimit(requestRateLimitKey(request, "delete-account", auth.user.id), 5, 900);
  if (limiter.unavailable) return rateLimitUnavailableResponse();
  if (!limiter.allowed) return rateLimitResponse(limiter.retryAfter);
  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";
  if (body?.confirm !== true) return error("Confirm that you want to permanently delete your account.");
  if (!auth.user.email || !password || password.length > 256) return error("Enter your password to delete your account.");
  const { data: checked, error: checkError } = await supabasePublic().auth.signInWithPassword({ email: auth.user.email, password });
  if (checkError || !checked.session || checked.user?.id !== auth.user.id) return error("That password is incorrect.", 401);
  try {
    await deleteAccountData(supabaseAdmin(), auth.user.id);
  } catch {
    return error("We couldn’t finish deleting your account. Nothing further has been shared; please try again.", 503);
  }
  const response = json({ deleted: true });
  clearSessionCookie(response);
  return response;
});
