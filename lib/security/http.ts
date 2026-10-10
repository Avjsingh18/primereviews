import { NextRequest, NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
}

export function siteOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured && process.env.NODE_ENV === "production") throw new HttpError(503, "The service is not configured.");
  const url = new URL(configured || request.url);
  if (url.username || url.password || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new HttpError(503, "The service is not configured.");
  return url.origin;
}

export function assertSameOrigin(request: NextRequest) {
  if (["GET", "HEAD"].includes(request.method)) return;
  if (request.headers.get("origin") !== siteOrigin(request) || request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "This request is not allowed.");
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) throw new HttpError(415, "Use a JSON request.");
}

// Bound streamed bodies too: Content-Length alone can be absent or dishonest.
export async function readJson(request: Pick<Request, "body" | "headers">, maxBytes = 8192, maxReadMs = 5000): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Enter valid request details.");
  const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new HttpError(408, "Request timed out.")), maxReadMs); });
  try {
    while (true) {
      const part = await Promise.race([reader.read(), deadline]); if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw new HttpError(413, "Request is too large.");
      chunks.push(part.value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch (cause) {
    void reader.cancel().catch(() => {});
    if (cause instanceof HttpError) throw cause;
    throw new HttpError(400, "Enter valid request details.");
  } finally {
    clearTimeout(timer!);
  }
}

export function safeRoute<Args extends unknown[]>(handler: (request: NextRequest, ...args: Args) => Promise<Response>) {
  return async (request: NextRequest, ...args: Args) => {
    try {
      assertSameOrigin(request);
      const response = await handler(request, ...args);
      if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Vary", "Cookie");
      return response;
    } catch (cause) {
      // Do not return or log provider payloads, credentials, or user input.
      return json({ error: cause instanceof HttpError ? cause.message : "The service is temporarily unavailable." }, cause instanceof HttpError ? cause.status : 503);
    }
  };
}
