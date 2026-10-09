import { NextResponse } from "next/server";
import { safeRoute, json } from "@/lib/security/http";
import { revokeSession, clearSessionCookie } from "@/lib/security/session";
import { publicRequestLimit } from "@/lib/rate-limit";

export const POST = safeRoute(async (request) => {
  await publicRequestLimit(request);
  await revokeSession(request);
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
});
