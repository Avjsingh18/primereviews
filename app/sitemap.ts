import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://primereviews.in";
const pages = ["/", "/login", "/signup", "/privacy", "/terms", "/refund-policy", "/cookies", "/acceptable-use"];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({ url: `${siteUrl}${path === "/" ? "" : path}`, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.5 }));
}
