import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const production = process.env.NODE_ENV === "production";
  const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const imageOrigin = storage ? new URL(storage).origin : "";
  const csp = ["default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${production ? "" : "'unsafe-eval'"}`, "style-src 'self' 'unsafe-inline'", `img-src 'self' data: blob: ${imageOrigin}`, "font-src 'self' data:", `connect-src 'self' ${production ? "" : "ws://localhost:3000 ws://127.0.0.1:3000"}`, ...(production ? ["upgrade-insecure-requests"] : [])].join("; ");
  const headers = new Headers(request.headers);
  // Overwrite incoming values; never trust a nonce supplied by a caller.
  headers.set("x-nonce", nonce); headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!api|r/|_next/static|_next/image|favicon.ico).*)"] };
