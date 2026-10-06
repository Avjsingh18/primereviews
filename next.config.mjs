const useLocalBackend = process.env.REVIEWFLOW_LOCAL_BACKEND === "true";
const localApiUrl = process.env.LOCAL_API_URL || "http://127.0.0.1:8081";

const nextConfig = {
  output: "standalone",
  async rewrites() {
    if (!useLocalBackend) return [];
    return {
      beforeFiles: [
        { source: "/api/auth/:path*", destination: `${localApiUrl}/api/auth/:path*` },
        { source: "/api/business/:path*", destination: `${localApiUrl}/api/business/:path*` },
        { source: "/api/analytics/:path*", destination: `${localApiUrl}/api/analytics/:path*` },
        { source: "/r/:slug", destination: `${localApiUrl}/r/:slug` },
      ],
    };
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
export default nextConfig;
