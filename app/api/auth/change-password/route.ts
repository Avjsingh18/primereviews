import { NextRequest, NextResponse } from "next/server";
import { error, requireUser } from "@/lib/api";
import { supabasePublic, supabaseAdmin } from "@/lib/supabase/server";
import { readJson, safeRoute, json } from "@/lib/security/http";
import { revokeUserSessions, clearSessionCookie } from "@/lib/security/session";
import { checkNewPassword } from "@/lib/security/password";
import { consumeRateLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";

export const POST = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;
  const limiter = await consumeRateLimit(requestRateLimitKey(request, "change-password", auth.user.id), 5, 900);
  if (limiter.unavailable) return rateLimitUnavailableResponse();
  if (!limiter.allowed) return rateLimitResponse(limiter.retryAfter);
  const body = await readJson(request);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  await checkNewPassword(newPassword);
  if (currentPassword.length>256) return error("Enter a valid current password.");
  if (!auth.user.email || !currentPassword) return error("Enter your current password.");
  const client = supabasePublic();
  const { data: checked, error: checkError } = await client.auth.signInWithPassword({ email: auth.user.email, password: currentPassword });
  if (checkError || !checked.session || checked.user?.id !== auth.user.id) return error("Your current password is incorrect.", 401);
  const db = supabaseAdmin();
  const locked = await db.rpc("security_password_lock", { p_user: auth.user.id });
  if (locked.error || !locked.data) return error("Account security is busy. Please try again later.", 503);
  try {
    const { error: updateError } = await db.auth.admin.updateUserById(auth.user.id, { password: newPassword });
    if (updateError) throw new Error("Password update unavailable");
    const revoked = await db.auth.admin.signOut(checked.session.access_token, "global");
    if (revoked.error) throw new Error("Provider revocation unavailable");
  } finally {
    await revokeUserSessions(auth.user.id);
    const unlocked = await db.rpc("security_password_unlock", { p_user: auth.user.id });
    if (unlocked.error) throw new Error("Account protection unavailable");
  }
  const response = json({ ok: true, signInRequired: true }); clearSessionCookie(response); return response;
});
