export function isGoogleReviewUrl(value: string) {
  if (value.length > 2048 || /[\u0000-\u0020\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if ([...url.searchParams.keys()].some(key => /^(url|redirect|redirect_uri|continue|next|target|destination)$/i.test(key))) return false;
    if (host === "g.page") return /^\/r\/[A-Za-z0-9_-]+\/review\/?$/.test(url.pathname) && !url.search;
    if (host === "maps.app.goo.gl") return /^\/[A-Za-z0-9_-]{5,100}$/.test(url.pathname) && [...url.searchParams.keys()].every(key => key === "g_st");
    if (!["google.com", "www.google.com", "search.google.com", "maps.google.com"].includes(host)) return false;
    if (url.pathname === "/local/writereview") return /^[A-Za-z0-9_-]{5,255}$/.test(url.searchParams.get("placeid") || "") && [...url.searchParams.keys()].every(key => key === "placeid");
    // Preserve legitimate Maps destinations, including the existing local fixture.
    if (/^\/maps\/(place\/[^\s]+|search\/?|\/?\s*)$/.test(url.pathname)) return [...url.searchParams.keys()].every(key => ["api", "query", "query_place_id", "cid", "hl"].includes(key));
    return false;
  } catch { return false; }
}
