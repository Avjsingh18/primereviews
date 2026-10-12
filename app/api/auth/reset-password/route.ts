import { NextRequest } from "next/server";
import { error } from "@/lib/api";
import { supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import { consumeRateLimit, publicRequestLimit, rateLimitResponse, rateLimitUnavailableResponse, requestRateLimitKey } from "@/lib/rate-limit";
import { HttpError, json, readJson, safeRoute } from "@/lib/security/http";
import { checkNewPassword } from "@/lib/security/password";
import { recoveryTokenIsFresh } from "@/lib/security/recovery";
import { revokeUserSessions } from "@/lib/security/session";
import { bestEffort } from "@/lib/security/cleanup";

const invalidLink = "This reset link has expired or was already used. Please request a new one.";

// Sets a new password from a password-reset email link, then signs the account out everywhere.
export const POST = safeRoute(async (request: NextRequest) => {
  const body = await readJson(request, 8192);
  await publicRequestLimit(request);
  const ipLimit = await consumeRateLimit(requestRateLimitKey(request, "reset-password-ip"), 15, 900);
  if (ipLimit.unavailable) return rateLimitUnavailableResponse();
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfter);
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
  const tokenHash = typeof body?.tokenHash === "string" ? body.tokenHash : "";
  if ((!accessToken && !tokenHash) || accessToken.length > 4096 || tokenHash.length > 256) return error(invalidLink);
  await checkNewPassword(body?.newPassword);
  const newPassword = body.newPassword as string;

  const client = supabasePublic();
  let userId: string; let sessionToken: string;
  if (tokenHash) {
    // Link carries a one-time token hash: redeeming it proves the person controls the email address.
    const { data, error: verifyError } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (verifyError || !data.user || !data.session) return error(invalidLink);
    userId = data.user.id; sessionToken = data.session.access_token;
  } else {
    const { data, error: userError } = await client.auth.getUser(accessToken);
    if (userError || !data.user || !recoveryTokenIsFresh(accessToken, data.user)) return error(invalidLink);
    userId = data.user.id; sessionToken = accessToken;
  }

  const userLimit = await consumeRateLimit(requestRateLimitKey(request, "reset-password", userId), 5, 900);
  if (userLimit.unavailable) return rateLimitUnavailableResponse();
  if (!userLimit.allowed) return rateLimitResponse(userLimit.retryAfter);
  const db = supabaseAdmin();
  const locked = await db.rpc("security_password_lock", { p_user: userId });
  if (locked.error || !locked.data) return error("Account security is busy. Please try again shortly.", 503);
  try {
    const { error: updateError } = await db.auth.admin.updateUserById(userId, { password: newPassword });
    if (updateError) {
      // Only the provider's error code and status are logged, never the password, token or email.
      console.error("reset-password: password update failed", updateError.code, updateError.status);
      if (updateError.code === "same_password") throw new HttpError(422, "Choose a password you have not used before. It must be different from your current password.");
      if (updateError.code === "weak_password") throw new HttpError(400, "That password is too easy to guess. Try a longer or less common one.");
      throw new Error("Password update unavailable");
    }
    // From here the password is already changed, so a clean-up problem must not report the reset as failed.
    // The account stays locked against new sessions and its stored sessions were deleted when the lock was taken.
    await bestEffort("reset-password", "provider global sign-out", async () => {
      const revoked = await db.auth.admin.signOut(sessionToken, "global");
      if (revoked.error) throw revoked.error;
    });
  } finally {
    await bestEffort("reset-password", "session revocation", () => revokeUserSessions(userId));
    await bestEffort("reset-password", "account unlock", async () => {
      const unlocked = await db.rpc("security_password_unlock", { p_user: userId });
      if (unlocked.error) throw unlocked.error;
    });
  }
  return json({ ok: true });
});
