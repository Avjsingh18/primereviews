import { NextRequest, NextResponse } from "next/server";
import { sessionCookie } from "@/lib/security/session";

const protectedRoutes = ["/dashboard", "/qr-code", "/benchmark", "/reviews", "/ai-insights", "/settings", "/locations", "/reports", "/integrations", "/onboarding"];

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function hasSessionCookie(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  return !!token && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function proxy(request: NextRequest) {
  if (isProtectedRoute(request.nextUrl.pathname) && !hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

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
