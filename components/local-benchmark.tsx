"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, MapPin, Search, Star, Trophy } from "lucide-react";
import ReputationShell from "./reputation-shell";
import styles from "./local-benchmark.module.css";

const categories = [{ value:"cafe", label:"Cafés" }, { value:"restaurant", label:"Restaurants" }, { value:"hotel", label:"Hotels" }, { value:"salon", label:"Salons" }, { value:"clinic", label:"Clinics" }, { value:"coaching centre", label:"Coaching centres" }, { value:"plant nursery", label:"Nurseries" }, { value:"gym", label:"Gyms" }];
type SortBy = "rating" | "reviews" | "distance" | "name";
type Place = { id:string; name:string; category:string; address:string|null; rating:number|null; reviewCount:number|null; ratingSource:"google"|null; distanceKm:number|null; distanceVerified:boolean; sourceUrl:string|null; googleMapsUrl:string|null; verificationStatus:"verified"|"needs_verification"; retrievedAt:string };
type Result = { businesses:Place[]; metadata:{ returnedCount:number; searchedAt:string; sourceStatus:"verified"|"partially_verified"; isComplete:boolean; cached:boolean }; myBusiness:{ rating:number|null; reviewCount:number|null } };

function displayDistance(distanceKm: number | null, verified: boolean) { if (distanceKm == null) return "Needs verification"; return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km${verified ? "" : " · verify"}`; }
function displayTime(iso: string) { return new Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short" }).format(new Date(iso)); }
function numeric(values: Array<number | null>) { return values.filter((value): value is number => value != null); }
function median(values: number[]) { const ordered = [...values].sort((a,b) => a-b); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2; }

export default function LocalBenchmark() {
  const [category, setCategory] = useState("cafe"); const [radiusKm, setRadiusKm] = useState(3); const [sortBy, setSortBy] = useState<SortBy>("rating");
  const [result, setResult] = useState<Result | null>(null); const [loading, setLoading] = useState(false); const [message, setMessage] = useState(""); const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const categoryLabel = categories.find((item) => item.value === category)?.label ?? category;
  const sortedPlaces = useMemo(() => {
    const places = [...(result?.businesses ?? [])];
    return places.sort((first, second) => {
      if (sortBy === "name") return first.name.localeCompare(second.name);
      if (sortBy === "distance") return (first.distanceKm ?? Number.POSITIVE_INFINITY) - (second.distanceKm ?? Number.POSITIVE_INFINITY) || first.name.localeCompare(second.name);
      if (sortBy === "reviews") return (second.reviewCount ?? -1) - (first.reviewCount ?? -1) || (second.rating ?? -1) - (first.rating ?? -1);
      return (second.rating ?? -1) - (first.rating ?? -1) || (second.reviewCount ?? -1) - (first.reviewCount ?? -1);
    });
  }, [result, sortBy]);
  const ratings = numeric(sortedPlaces.map((place) => place.rating)); const reviewCounts = numeric(sortedPlaces.map((place) => place.reviewCount));
  const higherRated = result?.myBusiness.rating == null ? null : sortedPlaces.filter((place) => place.rating != null && place.rating > result.myBusiness.rating!).length;
  const moreReviewed = result?.myBusiness.reviewCount == null ? null : sortedPlaces.filter((place) => place.reviewCount != null && place.reviewCount > result.myBusiness.reviewCount!).length;

  useEffect(() => {
    const token = localStorage.getItem("reviewflow_token");
    fetch("/api/business", { headers:{ Authorization:`Bearer ${token}` } }).then((response) => response.ok ? response.json() : null).then((business) => setHasLocation(Boolean(business && business.latitude != null && business.longitude != null))).catch(() => setHasLocation(false));
  }, []);

  async function search() {
    setLoading(true); setMessage("");
    try {
      const token = localStorage.getItem("reviewflow_token");
      const response = await fetch("/api/benchmark", { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body:JSON.stringify({ category, radiusKm, limit:25 }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setResult(data);
      if (!data.metadata.isComplete) setMessage(`${data.metadata.returnedCount} businesses found. Some additional listings could not be verified.`);
    } catch (cause) { setResult(null); setMessage(cause instanceof Error ? cause.message : "Couldn’t load nearby businesses."); }
    finally { setLoading(false); }
  }

  const userBusiness = result?.myBusiness;
  return <ReputationShell title="See how similar businesses compare nearby" description="Compare Google ratings and review counts within a chosen radius of your business.">
    {hasLocation === false ? <section className={styles.locationNeeded}><MapPin aria-hidden="true" /><div><strong>Add your business location first</strong><p>ReviewFlow needs your saved latitude and longitude to search businesses within 1 km, 3 km, or 5 km of you.</p></div><Link href="/settings">Add location</Link></section> : null}
    <section className={styles.searchCard} aria-label="Search local businesses"><div className={styles.form}><label className={styles.field}><span>Business category</span><select value={category} onChange={(event) => setCategory(event.target.value)} disabled={loading}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className={styles.field}><span>Search radius</span><select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} disabled={loading}><option value={1}>Within 1 km</option><option value={3}>Within 3 km</option><option value={5}>Within 5 km</option></select></label><button className={styles.searchButton} disabled={loading || hasLocation !== true} onClick={() => search()} type="button"><Search aria-hidden="true" />{loading ? "Finding businesses near you…" : "Find businesses"}</button></div></section>
    {message ? <p className={result ? styles.notice : styles.error}>{message}</p> : null}
    {result ? <>
      <section className={styles.resultMeta}><div><strong>{result.metadata.returnedCount} {categoryLabel.toLowerCase()} found within {radiusKm} km</strong><p>{result.metadata.cached ? "Cached result" : "Retrieved"} {displayTime(result.metadata.searchedAt)} · {result.metadata.sourceStatus === "verified" ? "Verified data" : "Partially verified data"}</p></div><p className={styles.cacheNote}>Results refresh automatically after 24 hours.</p></section>
      {userBusiness && (userBusiness.rating != null || userBusiness.reviewCount != null) && <section className={styles.comparison}><div><p>YOUR BUSINESS</p><h2>How you compare</h2></div><div className={styles.comparisonGrid}><article><span>My rating</span><strong>{userBusiness.rating?.toFixed(1) ?? "Not available"}</strong></article><article><span>My reviews</span><strong>{userBusiness.reviewCount?.toLocaleString() ?? "Not available"}</strong></article><article><span>Median competitor rating</span><strong>{ratings.length ? median(ratings).toFixed(1) : "Not available"}</strong></article><article><span>Median competitor reviews</span><strong>{reviewCounts.length ? Math.round(median(reviewCounts)).toLocaleString() : "Not available"}</strong></article></div>{higherRated != null || moreReviewed != null ? <p className={styles.insight}>{higherRated != null ? `${higherRated} nearby ${categoryLabel.toLowerCase()} have a higher verified rating than you.` : ""}{higherRated != null && moreReviewed != null ? " " : ""}{moreReviewed != null ? `${moreReviewed} have more verified reviews.` : ""}</p> : null}</section>}
      {sortedPlaces.length ? <section className={styles.results}><div className={styles.resultsHeader}><div><h2>Nearby competitors</h2><p>Ranked by {sortBy === "rating" ? "highest verified rating" : sortBy === "reviews" ? "most verified reviews" : sortBy === "distance" ? "nearest verified location" : "business name"}.</p></div><label className={styles.sortControl}><span>Rank by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}><option value="rating">Highest rating</option><option value="reviews">Most reviewed</option><option value="distance">Nearest first</option><option value="name">Name A–Z</option></select></label></div><div className={styles.table}><div className={`${styles.row} ${styles.rowHead}`}><span>Rank</span><span>Business</span><span>Distance</span><span>Google rating</span><span>Reviews</span><span>Source</span></div>{sortedPlaces.map((place, index) => { const stronger = userBusiness?.rating != null && userBusiness.reviewCount != null && place.rating != null && place.reviewCount != null && place.rating > userBusiness.rating && place.reviewCount > userBusiness.reviewCount; return <article className={`${styles.row} ${stronger ? styles.strongCompetitor : ""}`} key={place.id}><b className={styles.rank}>#{index + 1}</b><div className={styles.business}><strong>{place.name}</strong><small>{place.category} · {place.address ?? "Address not verified"}</small></div><span className={styles.distance}>{displayDistance(place.distanceKm, place.distanceVerified)}</span><span className={styles.rating}><Star aria-hidden="true" />{place.rating?.toFixed(1) ?? "Not available"}</span><span className={styles.reviewCount}>{place.reviewCount?.toLocaleString() ?? "Not verified"}</span><span className={styles.source}>{place.sourceUrl || place.googleMapsUrl ? <a href={place.sourceUrl || place.googleMapsUrl || undefined} target="_blank" rel="noreferrer">View source <ExternalLink aria-hidden="true" /></a> : "Not available"}</span></article>; })}</div></section> : !loading ? <section className={styles.empty}><Trophy aria-hidden="true" /><h2>No verified businesses found within this radius.</h2><p>Try increasing the search radius.</p></section> : null}
    </> : null}
  </ReputationShell>;
}
