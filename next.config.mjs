if (process.env.REVIEWFLOW_LOCAL_BACKEND === "true") throw new Error("Local connectivity belongs to the local branch, not this release.");

// Local UI preview only: with UI_MOCK_API=true (never in production) /api/* is served by scripts/ui-mock-server.mjs.
const mockApi = process.env.UI_MOCK_API === "true" && process.env.NODE_ENV !== "production";

const nextConfig = {
  output: "standalone",
  ...(mockApi ? { async rewrites() { return { beforeFiles: [{ source: "/api/:path*", destination: `http://localhost:${process.env.UI_MOCK_PORT || 3101}/api/:path*` }], afterFiles: [], fallback: [] }; } } : {}),
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      ],
    }, { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] }, { source: "/r/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] }];
  },
};
export default nextConfig;
