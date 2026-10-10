// A password may only be reset with a recovery session: one created by a password-reset email. This checks that a Supabase
// access token was issued recently and after a recovery email was sent, so an ordinary sign-in token cannot be used to
// skip the "current password" step. (Our own sign-in tokens never reach the browser either.)
export const RECOVERY_TOKEN_MAX_AGE_MS = 20 * 60_000;
export const RECOVERY_EMAIL_MAX_AGE_MS = 60 * 60_000;

export function recoveryTokenIsFresh(accessToken: string, user: { recovery_sent_at?: string | null }, now = Date.now()) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { iat?: unknown };
    const issuedAt = Number(payload.iat) * 1000;
    const sentAt = user.recovery_sent_at ? Date.parse(user.recovery_sent_at) : Number.NaN;
    if (!Number.isFinite(issuedAt) || !Number.isFinite(sentAt)) return false;
    return now - issuedAt >= -60_000 && now - issuedAt < RECOVERY_TOKEN_MAX_AGE_MS && now - sentAt < RECOVERY_EMAIL_MAX_AGE_MS && issuedAt >= sentAt - 60_000;
  } catch { return false; }
}
