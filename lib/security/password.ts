import { createHash } from "crypto";
import { HttpError } from "./http";
export async function checkNewPassword(password: unknown) {
  if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password)>72) throw new HttpError(400, "Use a password with at least 12 characters and no more than 72 bytes.");
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0,5)}`, { headers: { "Add-Padding": "true", "User-Agent": "PrimeReviews-password-security" }, signal: AbortSignal.timeout(5000), cache: "no-store" }).catch(() => null);
  if (!response?.ok) throw new HttpError(503, "Password security checks are unavailable. Please try again later.");
  const body = await response.text();
  if (body.length>2000000) throw new HttpError(503, "Password security checks are unavailable.");
  if (body.split(/\r?\n/).some(line=>line.split(":")[0]===hash.slice(5) && Number(line.split(":")[1])>0)) throw new HttpError(400, "This password has appeared in a data breach. Choose a different password.");
}
