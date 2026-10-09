import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { sessionCookie } from "@/lib/security/session";

test("redirects signed-out requests for protected product routes to login", () => {
  const response = proxy(new NextRequest("https://app.example/dashboard?range=30"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://app.example/login?next=%2Fdashboard%3Frange%3D30");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("allows public pages and requests with a correctly shaped session cookie", () => {
  assert.equal(proxy(new NextRequest("https://app.example/login")).status, 200);
  const request = new NextRequest("https://app.example/dashboard", {
    headers: { cookie: `${sessionCookie}=${"a".repeat(43)}` },
  });
  assert.equal(proxy(request).status, 200);
});
