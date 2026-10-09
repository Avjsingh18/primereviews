if (process.env.REVIEWFLOW_LOCAL_BACKEND === "true") throw new Error("Local connectivity belongs to the local branch, not this release.");

const nextConfig = {
  output: "standalone",
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
