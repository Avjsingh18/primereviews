"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CalendarDays, QrCode, Star, TrendingUp } from "lucide-react";
import ReputationShell from "./reputation-shell";
import styles from "./reputation.module.css";

type Overview = { rating: number | null; totalReviews: number | null; newReviews: number | null; ratingChange: number | null; qrScans: number; rangeStart: string; rangeEnd: string };
type Point = { date: string; value: number | null };
type DateWindow = { start: string; end: string; label: string };
type Metric = { title: string; value: string; note: string; icon: typeof Star };

function isoDate(offset = 0) { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
function preset(days: number): DateWindow { return { start: isoDate(1 - days), end: isoDate(), label: `Last ${days} days` }; }
function displayDate(date: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00Z`)); }
function query(window: DateWindow) { return `?start=${encodeURIComponent(window.start)}&end=${encodeURIComponent(window.end)}`; }
function formatDelta(value: number | null, fallback: string) { return value == null ? fallback : `${value >= 0 ? "+" : ""}${value.toFixed(1)}`; }
function MetricCard({ title, value, note, icon: Icon }: Metric) { return <article className={styles.dashboardMetric}><div><span>{title}</span><i><Icon /></i></div><strong>{value}</strong><p><ArrowUpRight />{note}</p></article>; }

export default function ReputationDashboard() {
  const [business, setBusiness] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ratings, setRatings] = useState<Point[]>([]);
  const [reviews, setReviews] = useState<Point[]>([]);
  const [scans, setScans] = useState<Point[]>([]);
  const [window, setWindow] = useState<DateWindow>(() => preset(30));
  const [customStart, setCustomStart] = useState(() => isoDate(-29));
  const [customEnd, setCustomEnd] = useState(() => isoDate());
  const [rangeError, setRangeError] = useState("");

  const load = useCallback(async () => {
    setRangeError("");
    try {
      const businessResponse = await fetch("/api/business");
      if (businessResponse.ok) setBusiness((await businessResponse.json()).name);
      // Overview runs first: a fresh Google fetch saves today's snapshot before graphs load.
      const overviewResponse = await fetch(`/api/analytics/overview${query(window)}`);
      if (!overviewResponse.ok) throw new Error("Couldn’t load dashboard analytics.");
      setOverview(await overviewResponse.json());
      const [ratingResponse, reviewResponse, scanResponse] = await Promise.all([fetch(`/api/analytics/rating${query(window)}`), fetch(`/api/analytics/reviews${query(window)}`), fetch(`/api/analytics/scans${query(window)}`)]);
      if (!ratingResponse.ok || !reviewResponse.ok || !scanResponse.ok) throw new Error("Couldn’t load dashboard charts.");
      setRatings(await ratingResponse.json()); setReviews(await reviewResponse.json()); setScans(await scanResponse.json());
    } catch (cause) { setRangeError(cause instanceof Error ? cause.message : "Couldn’t load dashboard analytics."); }
  }, [window]);

  useEffect(() => { void load(); }, [load]);
  const ratingData = useMemo(() => ratings.map(({ date, value }) => ({ label: displayDate(date), rating: value })), [ratings]);
  const reviewData = useMemo(() => reviews.map(({ date, value }) => ({ label: displayDate(date), reviews: value })), [reviews]);
  const scanData = useMemo(() => scans.map(({ date, value }) => ({ label: displayDate(date), scans: value ?? 0 })), [scans]);
  const metrics: Metric[] = [
    { title: "Current rating", value: overview?.rating == null ? "—" : overview.rating.toFixed(1), note: overview?.rating == null ? "No Google data found" : "Google Places", icon: Star },
    { title: "Total reviews", value: overview?.totalReviews == null ? "—" : overview.totalReviews.toLocaleString(), note: overview?.totalReviews == null ? "No Google data found" : "Google Places", icon: TrendingUp },
    { title: "QR visits", value: String(overview?.qrScans ?? 0), note: "In selected range", icon: QrCode },
    { title: "Rating change", value: formatDelta(overview?.ratingChange ?? null, "—"), note: overview?.ratingChange == null ? "No start-date snapshot" : `Since ${displayDate(overview.rangeStart)}`, icon: ArrowUpRight },
  ];
  function chooseRange(days: number) { const next = preset(days); setWindow(next); setCustomStart(next.start); setCustomEnd(next.end); }
  function applyCustomRange(event: FormEvent) {
    event.preventDefault();
    if (!customStart || !customEnd || customStart > customEnd || customEnd > isoDate()) return setRangeError("Choose a valid past date range.");
    if (Date.parse(`${customEnd}T00:00:00Z`) - Date.parse(`${customStart}T00:00:00Z`) > 365 * 86_400_000) return setRangeError("Choose a range of up to one year.");
    setWindow({ start: customStart, end: customEnd, label: `${displayDate(customStart)} – ${displayDate(customEnd)}` });
  }

  return <ReputationShell title={business ? `Good to see ${business}.` : "Your review overview"} description="Track saved Google rating snapshots and QR redirect visits for this business." actions={<Link className={styles.primary} href="/qr-code"><QrCode />Manage QR code</Link>}>
    <div className={styles.dashboardToolbar}><div className={styles.rangeControls}><span><CalendarDays />{window.label}</span><button type="button" onClick={() => chooseRange(7)}>7 days</button><button type="button" onClick={() => chooseRange(30)}>30 days</button><button type="button" onClick={() => chooseRange(90)}>90 days</button></div><p>Google ratings and review counts update automatically.</p></div>
    <form className={styles.customRange} onSubmit={applyCustomRange}><label>From<input type="date" value={customStart} max={customEnd || isoDate()} onChange={(event) => setCustomStart(event.target.value)} /></label><label>To<input type="date" value={customEnd} min={customStart} max={isoDate()} onChange={(event) => setCustomEnd(event.target.value)} /></label><button type="submit">Apply custom range</button>{rangeError ? <p role="alert">{rangeError}</p> : null}</form>
    <section className={styles.dashboardMetrics}>{metrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}</section>
    <section className={styles.dashboardCharts}>
      <article className={styles.chart}><h2>Review growth</h2><p>Total Google reviews, retained at the last confirmed daily value.</p><ResponsiveContainer width="100%" height={238}><AreaChart data={reviewData}><defs><linearGradient id="review-growth" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#6659ea" stopOpacity=".24" /><stop offset="1" stopColor="#6659ea" stopOpacity="0" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f6" /><XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={30} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip /><Area connectNulls type="stepAfter" dataKey="reviews" stroke="#6659ea" strokeWidth={2.5} fill="url(#review-growth)" /></AreaChart></ResponsiveContainer></article>
      <article className={styles.chart}><h2>Rating trend</h2><p>Daily Google rating snapshots.</p><ResponsiveContainer width="100%" height={238}><LineChart data={ratingData}><CartesianGrid vertical={false} stroke="#edf0f6" /><XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={30} /><YAxis domain={[0, 5]} axisLine={false} tickLine={false} /><Tooltip /><Line connectNulls type="stepAfter" dataKey="rating" stroke="#efa93c" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></article>
    </section>
    <section className={styles.scanChart}><div><div><h2>QR scans over time</h2><p>Each day is exact: zero means no recorded redirect that day.</p></div><span><i />QR scans</span></div><ResponsiveContainer width="100%" height={210}><AreaChart data={scanData}><defs><linearGradient id="qr-scans" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#2aa982" stopOpacity=".25" /><stop offset="1" stopColor="#2aa982" stopOpacity="0" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f6" /><XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={30} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip /><Area type="stepAfter" dataKey="scans" stroke="#2aa982" strokeWidth={2.5} fill="url(#qr-scans)" /></AreaChart></ResponsiveContainer></section>
    <section className={styles.dashboardComparison}><div><p>SNAPSHOT SUMMARY</p><h2>What your data shows</h2></div><div><article><small>RATING</small><b>{overview?.rating == null ? "—" : overview.rating.toFixed(1)}</b><span>Current Google rating</span></article><article><small>NEW REVIEWS</small><b>{overview?.newReviews == null ? "—" : `${overview.newReviews >= 0 ? "+" : ""}${overview.newReviews}`}</b><span>Since {overview ? displayDate(overview.rangeStart) : "range start"}</span></article><article><small>QR SCANS</small><b>{overview?.qrScans ?? 0}</b><span>In selected date range</span></article><article><small>REVIEW TOTAL</small><b>{overview?.totalReviews ?? "—"}</b><span>Current Google total</span></article></div></section>
  </ReputationShell>;
}
