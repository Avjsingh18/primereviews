"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CalendarDays, QrCode, Star, TrendingUp } from "lucide-react";
import ReputationShell from "./reputation-shell";
import styles from "./reputation.module.css";

type Overview = { rating: number | null; totalReviews: number | null; newReviews: number | null; ratingChange: number | null; qrScans: number; rangeStart: string; rangeEnd: string; ratings: Point[]; reviews: Point[]; scans: Point[] };
type Point = { date: string; value: number | null };
type DateWindow = { start: string; end: string; label: string };
type Metric = { title: string; value: string; note: string; icon: typeof Star };

function isoDate(offset = 0) { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
function preset(days: number): DateWindow { return { start: isoDate(1 - days), end: isoDate(), label: `Last ${days} days` }; }
function displayDate(date: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00Z`)); }
function query(window: DateWindow) { return `?start=${encodeURIComponent(window.start)}&end=${encodeURIComponent(window.end)}`; }
function formatDelta(value: number | null, fallback: string) { return value == null ? fallback : `${value >= 0 ? "+" : ""}${value.toFixed(1)}`; }
const AXIS = { fill: "#8f99bf", fontSize: 11 };
const TOOLTIP = { contentStyle: { background: "rgba(10,14,34,.92)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, color: "#eef0ff", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }, labelStyle: { color: "#9aa3c7" }, cursor: { stroke: "rgba(167,157,255,.4)" } };
// Counts up to numeric values the first time the card scrolls into view; other values (such as a dash) pass through.
function AnimatedValue({ value }: { value: string }) {
  const ref = useRef<HTMLElement>(null); const inView = useInView(ref, { once: true }); const reduced = useReducedMotion();
  useEffect(() => {
    const match = /^([+-]?)([\d,]+)(\.\d+)?$/.exec(value); const node = ref.current;
    if (!node || !inView || reduced || !match) return;
    const target = Number(`${match[2].replace(/,/g, "")}${match[3] ?? ""}`); const decimals = (match[3] ?? "").length;
    const controls = animate(0, target, { duration: 1.1, ease: "easeOut", onUpdate: (current) => { node.textContent = `${match[1]}${current.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`; }, onComplete: () => { node.textContent = value; } });
    return () => controls.stop();
  }, [value, inView, reduced]);
  return <strong ref={ref}>{value}</strong>;
}
function MetricCard({ title, value, note, icon: Icon }: Metric) { return <article className={styles.dashboardMetric}><div><span>{title}</span><i><Icon /></i></div><AnimatedValue value={value} /><p><ArrowUpRight />{note}</p></article>; }

export default function ReputationDashboard() {
  const [business, setBusiness] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [window, setWindow] = useState<DateWindow>(() => preset(30));
  const [customStart, setCustomStart] = useState(() => isoDate(-29));
  const [customEnd, setCustomEnd] = useState(() => isoDate());
  const [rangeError, setRangeError] = useState("");
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const rangeMenu = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setRangeError("");
    try {
      const [businessResponse, overviewResponse] = await Promise.all([fetch("/api/business"), fetch(`/api/analytics/overview${query(window)}`)]);
      if (businessResponse.ok) setBusiness((await businessResponse.json()).name);
      if (!overviewResponse.ok) throw new Error("Couldn’t load dashboard analytics.");
      setOverview(await overviewResponse.json());
    } catch (cause) { setRangeError(cause instanceof Error ? cause.message : "Couldn’t load dashboard analytics."); }
  }, [window]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (rangeMenu.current && !rangeMenu.current.contains(event.target as Node)) setRangeMenuOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);
  const ratingData = useMemo(() => (overview?.ratings ?? []).map(({ date, value }) => ({ label: displayDate(date), rating: value })), [overview]);
  const reviewData = useMemo(() => (overview?.reviews ?? []).map(({ date, value }) => ({ label: displayDate(date), reviews: value })), [overview]);
  const scanData = useMemo(() => (overview?.scans ?? []).map(({ date, value }) => ({ label: displayDate(date), scans: value ?? 0 })), [overview]);
  const metrics: Metric[] = [
    { title: "Current rating", value: overview?.rating == null ? "—" : overview.rating.toFixed(1), note: overview?.rating == null ? "No Google data found" : "Google Places", icon: Star },
    { title: "Total reviews", value: overview?.totalReviews == null ? "—" : overview.totalReviews.toLocaleString(), note: overview?.totalReviews == null ? "No Google data found" : "Google Places", icon: TrendingUp },
    { title: "QR visits", value: String(overview?.qrScans ?? 0), note: "In selected range", icon: QrCode },
    { title: "Rating change", value: formatDelta(overview?.ratingChange ?? null, "—"), note: overview?.ratingChange == null ? "No start-date snapshot" : `Since ${displayDate(overview.rangeStart)}`, icon: ArrowUpRight },
  ];
  function chooseRange(days: number) { const next = preset(days); setWindow(next); setCustomStart(next.start); setCustomEnd(next.end); setShowCustomRange(false); setRangeMenuOpen(false); }
  function applyCustomRange(event: FormEvent) {
    event.preventDefault();
    if (!customStart || !customEnd || customStart > customEnd || customEnd > isoDate()) return setRangeError("Choose a valid past date range.");
    if (Date.parse(`${customEnd}T00:00:00Z`) - Date.parse(`${customStart}T00:00:00Z`) > 365 * 86_400_000) return setRangeError("Choose a range of up to one year.");
    setWindow({ start: customStart, end: customEnd, label: `${displayDate(customStart)} – ${displayDate(customEnd)}` }); setShowCustomRange(false); setRangeMenuOpen(false);
  }

  return <ReputationShell title={business ? `Welcome back, ${business}` : "Your review overview"} description="Your Google ratings, reviews, and QR visits at a glance." actions={<Link className={styles.primary} href="/qr-code"><QrCode />Manage QR code</Link>}>
    <div className={styles.dashboardToolbar}><div className={styles.rangePicker} ref={rangeMenu}><button className={styles.rangeTrigger} type="button" aria-expanded={rangeMenuOpen} aria-haspopup="dialog" onClick={() => setRangeMenuOpen((value) => !value)}><CalendarDays />{window.label}</button>{rangeMenuOpen ? <div className={styles.rangeDrawer} role="dialog" aria-label="Select dashboard date range"><button type="button" onClick={() => chooseRange(7)}>Last 7 days</button><button type="button" onClick={() => chooseRange(30)}>Last 30 days</button><button type="button" onClick={() => chooseRange(90)}>Last 90 days</button><button type="button" onClick={() => setShowCustomRange((value) => !value)}>Custom range</button>{showCustomRange ? <form className={styles.customRange} onSubmit={applyCustomRange}><label>From<input type="date" value={customStart} max={customEnd || isoDate()} onChange={(event) => setCustomStart(event.target.value)} /></label><label>To<input type="date" value={customEnd} min={customStart} max={isoDate()} onChange={(event) => setCustomEnd(event.target.value)} /></label><button type="submit">Apply dates</button></form> : null}</div> : null}</div>{rangeError ? <p className={styles.rangeError} role="alert">{rangeError}</p> : null}</div>
    <section className={styles.dashboardMetrics}>{metrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}</section>
    <section className={styles.dashboardCharts}>
      <article className={styles.chart}><h2>Review growth</h2><p>Total Google reviews, retained at the last confirmed daily value.</p><ResponsiveContainer width="100%" height={238}><AreaChart data={reviewData}><defs><linearGradient id="review-growth" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#8f84ff" stopOpacity=".38" /><stop offset="1" stopColor="#8f84ff" stopOpacity="0" /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,.08)" /><XAxis tick={AXIS} dataKey="label" axisLine={false} tickLine={false} minTickGap={30} /><YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip {...TOOLTIP} /><Area connectNulls type="stepAfter" dataKey="reviews" stroke="#8f84ff" strokeWidth={2.5} fill="url(#review-growth)" /></AreaChart></ResponsiveContainer></article>
      <article className={styles.chart}><h2>Rating trend</h2><p>Daily Google rating snapshots.</p><ResponsiveContainer width="100%" height={238}><LineChart data={ratingData}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.08)" /><XAxis tick={AXIS} dataKey="label" axisLine={false} tickLine={false} minTickGap={30} /><YAxis tick={AXIS} domain={[0, 5]} axisLine={false} tickLine={false} /><Tooltip {...TOOLTIP} /><Line connectNulls type="stepAfter" dataKey="rating" stroke="#fbbf24" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></article>
    </section>
    <section className={styles.scanChart}><div><div><h2>QR scans over time</h2><p>Each day is exact: zero means no recorded redirect that day.</p></div><span><i />QR scans</span></div><ResponsiveContainer width="100%" height={210}><AreaChart data={scanData}><defs><linearGradient id="qr-scans" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#34d399" stopOpacity=".34" /><stop offset="1" stopColor="#34d399" stopOpacity="0" /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,.08)" /><XAxis tick={AXIS} dataKey="label" axisLine={false} tickLine={false} minTickGap={30} /><YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip {...TOOLTIP} /><Area type="stepAfter" dataKey="scans" stroke="#34d399" strokeWidth={2.5} fill="url(#qr-scans)" /></AreaChart></ResponsiveContainer></section>
    <section className={styles.dashboardComparison}><div><p>SNAPSHOT SUMMARY</p><h2>What your data shows</h2></div><div><article><small>RATING</small><b>{overview?.rating == null ? "—" : overview.rating.toFixed(1)}</b><span>Current Google rating</span></article><article><small>NEW REVIEWS</small><b>{overview?.newReviews == null ? "—" : `${overview.newReviews >= 0 ? "+" : ""}${overview.newReviews}`}</b><span>Since {overview ? displayDate(overview.rangeStart) : "range start"}</span></article><article><small>QR SCANS</small><b>{overview?.qrScans ?? 0}</b><span>In selected date range</span></article><article><small>REVIEW TOTAL</small><b>{overview?.totalReviews ?? "—"}</b><span>Current Google total</span></article></div></section>
  </ReputationShell>;
}
