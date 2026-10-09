import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { Session } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabasePublic } from "@/lib/supabase/server";
import { HttpError } from "./http";

export const sessionCookie = process.env.NODE_ENV === "production" ? "__Host-prime_reviews_session" : "prime_reviews_session";
const lifetime = 7 * 86400;
type StoredSession = { token_hash: string; user_id: string; access_cipher: string; refresh_cipher: string; token_expires_at: string; expires_at: string };
function key() {
  const value = process.env.SESSION_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new HttpError(503, "Session protection is not configured.");
  return Buffer.from(value, "hex");
}
export function encryptToken(value: string, context: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64url");
}
export function decryptToken(value: string, context: string) {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 29 || bytes.length > 16384) throw new Error("Invalid session");
  const cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString("utf8");
}
function hash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function tokenHash(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? hash(token) : null;
}
function encrypted(session: Session, token_hash: string) {
  return { access_cipher: encryptToken(session.access_token, `${token_hash}:access`), refresh_cipher: encryptToken(session.refresh_token, `${token_hash}:refresh`), token_expires_at: new Date((session.expires_at || 0) * 1000).toISOString() };
}
export async function authenticationStarted() {
  const { data, error } = await supabaseAdmin().rpc("security_auth_time");
  if (error || !data) throw new Error("Authentication protection unavailable");
  return String(data);
}
export async function issueSession(response: NextResponse, session: Session, startedAt: string) {
  const token = randomBytes(32).toString("base64url"); const token_hash = hash(token);
  const values = encrypted(session, token_hash);
  const { error } = await supabaseAdmin().rpc("security_insert_session", { p_hash: token_hash, p_user: session.user.id, p_access: values.access_cipher, p_refresh: values.refresh_cipher, p_token_expiry: values.token_expires_at, p_started: startedAt });
  if (error) throw new Error("Session storage unavailable");
  response.cookies.set(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: lifetime });
  if (sessionCookie !== "prime_reviews_session") response.cookies.set("prime_reviews_session", "", { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 0 });
}
export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  if (sessionCookie !== "prime_reviews_session") response.cookies.set("prime_reviews_session", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}
export async function loadSession(request: NextRequest) {
  const token_hash = tokenHash(request); if (!token_hash) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.from("app_sessions").select("*").eq("token_hash", token_hash).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error("Session storage unavailable");
  let row = data as StoredSession | null; if (!row) return null;
  if (Date.parse(row.token_expires_at) < Date.now() + 60000) {
    const { data: claimed, error: claimError } = await db.rpc("security_claim_refresh", { p_hash: token_hash });
    if (claimError) throw new Error("Session refresh unavailable");
    if (!claimed) throw new HttpError(503, "Your session is refreshing. Please try again shortly.");
    row = claimed as StoredSession;
    const { data: refreshed, error: refreshError } = await supabasePublic().auth.refreshSession({ refresh_token: decryptToken(row.refresh_cipher, `${token_hash}:refresh`) });
    if (refreshError || !refreshed.session || refreshed.session.user.id !== row.user_id) {
      await db.from("app_sessions").delete().eq("token_hash", token_hash); return null;
    }
    const updates = encrypted(refreshed.session, token_hash);
    const { data: saved, error: saveError } = await db.from("app_sessions").update({ ...updates, refresh_lock_until: null }).eq("token_hash", token_hash).select("token_hash").maybeSingle();
    // Logout may have deleted the row during refresh. Never resurrect it.
    if (saveError) throw new Error("Session refresh unavailable");
    if (!saved) return null;
    row = { ...row, ...updates };
  }
  return { token_hash, userId: row.user_id, accessToken: decryptToken(row.access_cipher, `${token_hash}:access`) };
}
export async function revokeSession(request: NextRequest) {
  const token_hash = tokenHash(request); if (!token_hash) return;
  const db = supabaseAdmin();
  const { data, error } = await db.from("app_sessions").delete().eq("token_hash", token_hash).select("access_cipher").maybeSingle();
  if (error) throw new Error("Session revocation unavailable");
  if (data) {
    const { error: revokeError } = await db.auth.admin.signOut(decryptToken(data.access_cipher, `${token_hash}:access`), "local");
    if (revokeError) throw new Error("Provider session revocation unavailable");
  }
}
export async function revokeUserSessions(userId: string) {
  const { error } = await supabaseAdmin().from("app_sessions").delete().eq("user_id", userId);
  if (error) throw new Error("Session revocation unavailable");
}
