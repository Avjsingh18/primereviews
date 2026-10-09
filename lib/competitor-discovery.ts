import { createHash } from "crypto";
import { z } from "zod";
import { readJson } from "@/lib/security/http";

export const categories = {
  cafe: { label: "Cafés", variants: ["cafes", "coffee shops", "coffee houses"] },
  restaurant: { label: "Restaurants", variants: ["restaurants"] },
  hotel: { label: "Hotels", variants: ["hotels"] },
  salon: { label: "Salons", variants: ["beauty salons", "hair salons"] },
  clinic: { label: "Clinics", variants: ["clinics"] },
  "coaching centre": { label: "Coaching centres", variants: ["coaching centres", "tutorial centres"] },
  "plant nursery": { label: "Nurseries", variants: ["plant nurseries", "garden centres"] },
  gym: { label: "Gyms", variants: ["gyms", "fitness centres"] },
} as const;

export type Category = keyof typeof categories;
export type NearbySearchRequest = { latitude: number; longitude: number; category: Category; radiusKm: 1 | 3 | 5; limit: number };
export type Competitor = {
  id: string; name: string; category: string; rating: number | null; reviewCount: number | null; ratingSource: "google" | null;
  address: string | null; latitude: number | null; longitude: number | null; distanceKm: number | null; distanceVerified: boolean;
  sourceUrl: string | null; googleMapsUrl: string | null; verificationStatus: "verified" | "needs_verification"; retrievedAt: string;
};
export type NearbySearchResponse = { businesses: Competitor[]; provider: "openai_web_search"; sourceStatus: "verified" | "partially_verified"; isComplete: boolean; searchedAt: string };

const rawBusinessSchema = z.object({
  name: z.string().trim().min(1).max(180), category: z.string().trim().min(1).max(120), address: z.string().trim().max(350).nullable(),
  rating: z.number().min(0).max(5).nullable(), reviewCount: z.number().int().nonnegative().nullable(), ratingSource: z.enum(["google", "other", "unknown"]).nullable(),
  latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(),
  sourceUrl: z.string().url().nullable(), googleMapsUrl: z.string().url().nullable(), permanentlyClosed: z.boolean(),
});
const rawResponseSchema = z.object({ businesses: z.array(rawBusinessSchema).max(25) });

export interface BusinessSearchProvider { searchNearbyBusinesses(request: NearbySearchRequest): Promise<NearbySearchResponse>; }

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(lat2 - lat1); const deltaLongitude = radians(lon2 - lon1);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function outputText(payload: unknown) {
  const response = payload as { output_text?: unknown; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: unknown }> }> };
  if (typeof response.output_text === "string") return response.output_text;
  return response.output?.flatMap((item) => item.type === "message" ? item.content ?? [] : []).map((content) => typeof content.text === "string" ? content.text : "").join("") ?? "";
}

function citedUrls(payload: unknown) {
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.type === "url_citation" && typeof record.url === "string") found.add(record.url);
    Object.values(record).forEach(visit);
  };
  visit(payload);
  return found;
}

function isGoogleUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && (url.hostname === "google.com" || url.hostname === "www.google.com" || url.hostname === "maps.google.com") && url.pathname.startsWith("/maps/"); } catch { return false; }
}
function safeSource(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && value.length <= 2048 ? value : null; } catch { return null; }
}

function stableId(name: string, address: string | null) { return createHash("sha256").update(`${name.trim().toLowerCase()}|${address?.trim().toLowerCase() ?? ""}`).digest("hex").slice(0, 24); }

function matchesCategory(category: Category, value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z]+/g, " ");
  const words = [category, ...categories[category].variants].map((item) => item.toLowerCase().replace(/[^a-z]+/g, " ").replace(/s\b/g, "").trim());
  return words.some((word) => normalized.includes(word));
}

export class OpenAIWebSearchProvider implements BusinessSearchProvider {
  constructor(private readonly apiKey: string, private readonly timeoutMs: number, private readonly model: string) {}

  async searchNearbyBusinesses(request: NearbySearchRequest): Promise<NearbySearchResponse> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const category = categories[request.category]; const searchedAt = new Date().toISOString();
    const schema = {
      type: "object", additionalProperties: false, required: ["businesses"], properties: {
        businesses: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "category", "address", "rating", "reviewCount", "ratingSource", "latitude", "longitude", "sourceUrl", "googleMapsUrl", "permanentlyClosed"], properties: {
          name: { type: "string" }, category: { type: "string" }, address: { type: ["string", "null"] }, rating: { type: ["number", "null"] }, reviewCount: { type: ["integer", "null"] }, ratingSource: { type: ["string", "null"], enum: ["google", "other", "unknown", null] }, latitude: { type: ["number", "null"] }, longitude: { type: ["number", "null"] }, sourceUrl: { type: ["string", "null"] }, googleMapsUrl: { type: ["string", "null"] }, permanentlyClosed: { type: "boolean" },
        } } },
      },
    };
    const prompt = [
      "You are a local business discovery assistant. Return JSON only.",
      `Find up to ${request.limit} real, currently operating ${category.label.toLowerCase()} within ${request.radiusKm} km of latitude ${request.latitude}, longitude ${request.longitude}.`,
      `Search variations as needed: ${category.variants.join(", ")}. Do not include unrelated categories merely to fill the list.`,
      "Use current, public sources. Do not invent names, ratings, review counts, addresses, URLs, or coordinates. Omit a value when it cannot be supported by a source.",
      "Only set ratingSource to google when both rating and reviewCount are supported by a direct Google URL in sourceUrl. Otherwise use nulls for rating, reviewCount, and ratingSource.",
      "Only provide coordinates when a source supports them. Exclude permanently closed businesses. Remove duplicates. Return fewer records when fewer businesses can be supported.",
    ].join("\n");
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, store: false, max_output_tokens: 6000, max_tool_calls: 2, tool_choice: "required", tools: [{ type: "web_search", search_context_size: "low" }], text: { format: { type: "json_schema", name: "nearby_businesses", strict: true, schema } }, input: prompt }),
      });
      if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
      const payload = await readJson(response, 262144); const parsed = rawResponseSchema.safeParse(JSON.parse(outputText(payload)));
      if (!parsed.success) throw new Error("OpenAI returned an invalid business-search response");
      const citations = citedUrls(payload); const radius = request.radiusKm; const seen = new Set<string>();
      const businesses = parsed.data.businesses.flatMap((business) => {
        if (business.permanentlyClosed || !matchesCategory(request.category, business.category) || seen.has(stableId(business.name, business.address))) return [];
        seen.add(stableId(business.name, business.address));
        const hasCoordinates = business.latitude != null && business.longitude != null;
        const distanceKm = hasCoordinates ? haversineDistanceKm(request.latitude, request.longitude, business.latitude!, business.longitude!) : null;
        if (distanceKm != null && distanceKm > radius) return [];
        const sourceUrl = business.sourceUrl && citations.has(business.sourceUrl) ? safeSource(business.sourceUrl) : null;
        const googleVerified = Boolean(sourceUrl && isGoogleUrl(sourceUrl) && business.ratingSource === "google" && business.rating != null && business.reviewCount != null);
        // A citation is not independent verification of model-extracted numbers.
        return [{ id: stableId(business.name, business.address), name: business.name, category: business.category, address: business.address, latitude: business.latitude, longitude: business.longitude, distanceKm: distanceKm == null ? null : Number(distanceKm.toFixed(2)), distanceVerified: false, sourceUrl, googleMapsUrl: business.googleMapsUrl && citations.has(business.googleMapsUrl) && isGoogleUrl(business.googleMapsUrl) ? business.googleMapsUrl : null, rating: googleVerified ? business.rating : null, reviewCount: googleVerified ? business.reviewCount : null, ratingSource: googleVerified ? "google" as const : null, verificationStatus: "needs_verification" as const, retrievedAt: searchedAt }];
      }).sort((a, b) => Number(b.distanceVerified) - Number(a.distanceVerified) || (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? -1) - (a.reviewCount ?? -1)).slice(0, request.limit);
      return { businesses, provider: "openai_web_search", sourceStatus: "partially_verified", isComplete: false, searchedAt };
    } finally { clearTimeout(timeout); }
  }
}
