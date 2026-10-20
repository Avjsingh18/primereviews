"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MapPin, Search } from "lucide-react";
import { placeIdFromReviewUrl } from "@/lib/places-id";
import styles from "./business-finder.module.css";

export type PlaceChoice = { placeId: string; name: string; address: string | null };

async function lookup(body: { query: string } | { placeId: string }): Promise<PlaceChoice[]> {
  const response = await fetch("/api/places/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "We couldn’t search Google right now. Please try again.");
  return Array.isArray(data.places) ? data.places : [];
}

// Lets an owner find their own business on Google from anywhere: no device location and no coordinates are asked for.
export default function BusinessFinder({ initialQuery, reviewUrl, selected, onSelect }: { initialQuery: string; reviewUrl?: string; selected: PlaceChoice | null; onSelect: (place: PlaceChoice) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PlaceChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [fromLink, setFromLink] = useState(false);
  const autoTried = useRef(false);

  // A review link such as ...writereview?placeid=... already names the business, so offer it without any searching.
  useEffect(() => {
    const linked = reviewUrl ? placeIdFromReviewUrl(reviewUrl) : null;
    if (!linked || selected || autoTried.current) return;
    autoTried.current = true;
    lookup({ placeId: linked }).then((places) => { if (places[0]) { onSelect(places[0]); setFromLink(true); } }).catch(() => {});
  }, [reviewUrl, selected, onSelect]);

  async function search() {
    const text = query.trim();
    if (text.length < 3) return setMessage("Type your business name and area, for example “Sharma Dental Clinic Noida”.");
    setBusy(true); setMessage(""); setFromLink(false);
    try { setResults(await lookup({ query: text })); setSearched(true); }
    catch (cause) { setResults([]); setMessage(cause instanceof Error ? cause.message : "We couldn’t search Google right now."); }
    finally { setBusy(false); }
  }

  return <div className={styles.finder}>
    {selected ? <div className={styles.selected} role="status"><Check aria-hidden="true" /><div><strong>{selected.name}</strong>{selected.address ? <span>{selected.address}</span> : null}<small>{fromLink ? "Found from your review link. " : ""}This is the business we will track.</small></div></div> : null}
    <label className={styles.label}>Search for your business on Google
      <div className={styles.row}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} placeholder="Business name and area, e.g. Sharma Dental Clinic Noida" maxLength={120} />
        <button type="button" className="outline" onClick={() => void search()} disabled={busy}><Search />{busy ? "Searching…" : "Search"}</button>
      </div>
    </label>
    {message ? <p className={styles.note} role="alert">{message}</p> : null}
    {searched && !results.length && !message ? <p className={styles.note}>No matching business found. Try adding your area or city, or check the spelling.</p> : null}
    {results.length ? <ul className={styles.results} aria-label="Matching businesses">{results.map((place) => <li key={place.placeId}><button type="button" className={`${styles.option} ${selected?.placeId === place.placeId ? styles.chosen : ""}`} onClick={() => { onSelect(place); setFromLink(false); }} aria-pressed={selected?.placeId === place.placeId}><MapPin aria-hidden="true" /><span><strong>{place.name}</strong>{place.address ? <small>{place.address}</small> : null}</span></button></li>)}</ul> : null}
  </div>;
}
