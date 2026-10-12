import { NextRequest, NextResponse } from "next/server";
import { error, requireUser } from "@/lib/api";
import { supabasePublic, supabaseAdmin } from "@/lib/supabase/server";
import { HttpError, readJson, safeRoute, json } from "@/lib/security/http";
import { bestEffort } from "@/lib/security/cleanup";
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
    if (updateError) {
      console.error("change-password: password update failed", updateError.code, updateError.status);
      if (updateError.code === "same_password") throw new HttpError(422, "Choose a password you have not used before. It must be different from your current password.");
      if (updateError.code === "weak_password") throw new HttpError(400, "That password is too easy to guess. Try a longer or less common one.");
      throw new Error("Password update unavailable");
    }
    // The password is already changed, so a clean-up problem must not report the change as failed.
    await bestEffort("change-password", "provider global sign-out", async () => {
      const revoked = await db.auth.admin.signOut(checked.session!.access_token, "global");
      if (revoked.error) throw revoked.error;
    });
  } finally {
    await bestEffort("change-password", "session revocation", () => revokeUserSessions(auth.user.id));
    await bestEffort("change-password", "account unlock", async () => {
      const unlocked = await db.rpc("security_password_unlock", { p_user: auth.user.id });
      if (unlocked.error) throw unlocked.error;
    });
  }
  const response = json({ ok: true, signInRequired: true }); clearSessionCookie(response); return response;
});
