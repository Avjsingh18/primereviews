"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CalendarDays, QrCode, Star, TrendingUp } from "lucide-react";
import ReputationShell from "./reputation-shell";
import styles from "./reputation.module.css";

type Overview = { rating: number | null; totalReviews: number | null; newReviews: number | null; ratingChange: number | null; qrScans: number };
type Point = { date: string; value: number };
type Metric = { title: string; value: string; note: string; icon: typeof Star };

function MetricCard({ title, value, note, icon: Icon }: Metric) {
  return <article className={styles.dashboardMetric}><div><span>{title}</span><i><Icon /></i></div><strong>{value}</strong><p><ArrowUpRight />{note}</p></article>;
}

export default function ReputationDashboard() {
  const [business, setBusiness] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ratings, setRatings] = useState<Point[]>([]);
  const [reviews, setReviews] = useState<Point[]>([]);
  const [scans, setScans] = useState<Point[]>([]);

  useEffect(() => {
    const headers = {};
    Promise.all([fetch("/api/business", { headers }), fetch("/api/analytics/overview", { headers }), fetch("/api/analytics/rating", { headers }), fetch("/api/analytics/reviews", { headers }), fetch("/api/analytics/scans", { headers })])
      .then(async ([businessResponse, overviewResponse, ratingResponse, reviewResponse, scanResponse]) => {
        if (businessResponse.ok) setBusiness((await businessResponse.json()).name);
        if (overviewResponse.ok) setOverview(await overviewResponse.json());
        if (ratingResponse.ok) setRatings(await ratingResponse.json());
        if (reviewResponse.ok) setReviews(await reviewResponse.json());
        if (scanResponse.ok) setScans(await scanResponse.json());
      }).catch(() => undefined);
  }, []);

  const ratingData = ratings.map(({ date, value }) => ({ label: date.slice(5), rating: value }));
  const reviewData = reviews.map(({ date, value }) => ({ label: date.slice(5), reviews: value }));
  const scanData = scans.map(({ date, value }) => ({ label: date.slice(5), scans: value }));
  const metrics: Metric[] = [
    { title: "Current rating", value: overview?.rating == null ? "—" : overview.rating.toFixed(1), note: overview?.rating == null ? "No rating recorded" : "Manual snapshot", icon: Star },
    { title: "Total reviews", value: overview?.totalReviews == null ? "—" : overview.totalReviews.toLocaleString(), note: overview?.totalReviews == null ? "No reviews recorded" : "Manual snapshot", icon: TrendingUp },
    { title: "QR visits", value: String(overview?.qrScans ?? 0), note: overview?.qrScans ? "Recorded redirects" : "No visits yet", icon: QrCode },
    { title: "Rating change", value: overview?.ratingChange == null ? "—" : `${overview.ratingChange >= 0 ? "+" : ""}${overview.ratingChange.toFixed(1)}`, note: overview?.ratingChange == null ? "No comparison yet" : "Since first snapshot", icon: ArrowUpRight },
  ];

  return <ReputationShell title={business ? `Good to see ${business}.` : "Your review overview"} description="A clear view of the review snapshots and QR scans saved for this business." actions={<Link className={styles.primary} href="/qr-code"><QrCode />Manage QR code</Link>}>
    <div className={styles.dashboardToolbar}><span><CalendarDays />Last 30 days</span><p>Google review data is manually recorded until Google sync is connected.</p></div>
    <section className={styles.dashboardMetrics}>{metrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}</section>
    <section className={styles.dashboardCharts}>
      <article className={styles.chart}><h2>Review growth</h2><p>Total recorded Google reviews over time.</p><ResponsiveContainer width="100%" height={238}><AreaChart data={reviewData}><defs><linearGradient id="review-growth" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#6659ea" stopOpacity=".24" /><stop offset="1" stopColor="#6659ea" stopOpacity="0" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f6" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="reviews" stroke="#6659ea" strokeWidth={2.5} fill="url(#review-growth)" /></AreaChart></ResponsiveContainer></article>
      <article className={styles.chart}><h2>Rating trend</h2><p>Recorded Google rating over time.</p><ResponsiveContainer width="100%" height={238}><LineChart data={ratingData}><CartesianGrid vertical={false} stroke="#edf0f6" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis domain={[0, 5]} axisLine={false} tickLine={false} /><Tooltip /><Line type="stepAfter" dataKey="rating" stroke="#efa93c" strokeWidth={2.5} dot={{ fill: "#efa93c", r: 3 }} /></LineChart></ResponsiveContainer></article>
    </section>
    <section className={styles.scanChart}><div><div><h2>QR scans over time</h2><p>Redirect visits, not unique people or completed Google reviews.</p></div><span><i />QR scans</span></div><ResponsiveContainer width="100%" height={210}><AreaChart data={scanData}><defs><linearGradient id="qr-scans" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#2aa982" stopOpacity=".25" /><stop offset="1" stopColor="#2aa982" stopOpacity="0" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f6" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="scans" stroke="#2aa982" strokeWidth={2.5} fill="url(#qr-scans)" /></AreaChart></ResponsiveContainer></section>
    <section className={styles.dashboardComparison}><div><p>SNAPSHOT SUMMARY</p><h2>What the local data shows</h2></div><div><article><small>RATING</small><b>{overview?.rating == null ? "—" : overview.rating.toFixed(1)}</b><span>Current rating</span></article><article><small>NEW REVIEWS</small><b>{overview?.newReviews == null ? "—" : `+${overview.newReviews}`}</b><span>In the last 30 days</span></article><article><small>QR SCANS</small><b>{overview?.qrScans ?? 0}</b><span>Recorded by PrimeReviews</span></article><article><small>REVIEW TOTAL</small><b>{overview?.totalReviews ?? "—"}</b><span>Latest saved snapshot</span></article></div></section>
  </ReputationShell>;
}
