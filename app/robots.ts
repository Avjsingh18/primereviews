import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://primereviews.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/r/", "/dashboard", "/onboarding", "/qr-code", "/settings", "/reset-password", "/reviews", "/reports", "/benchmark", "/locations", "/integrations", "/ai-insights"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
