// Google place IDs look like "ChIJN1t_tDeuEmsRUsoyG83frY4". They are opaque, so only the safe character set and a sane length are checked.
export function isPlaceId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{10,255}$/.test(value);
}

// Some Google review links carry the business's place ID, for example
// https://search.google.com/local/writereview?placeid=ChIJ... . Short links (g.page, maps.app.goo.gl) do not.
export function placeIdFromReviewUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["google.com", "www.google.com", "search.google.com", "maps.google.com"].includes(url.hostname.toLowerCase())) return null;
    const candidate = url.searchParams.get("placeid") ?? url.searchParams.get("query_place_id");
    return isPlaceId(candidate) ? candidate : null;
  } catch { return null; }
}
