"use client";
import Link from "next/link";
import { Bot, FileText, LayoutDashboard, MapPin, QrCode, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import styles from "./reputation.module.css";

const links: Array<[string, string, typeof LayoutDashboard]> = [["/dashboard", "Dashboard", LayoutDashboard], ["/qr-code", "QR code", QrCode], ["/benchmark", "Local rankings", MapPin], ["/reviews", "Reviews", FileText], ["/ai-insights", "AI Insights", Bot], ["/settings", "Settings", Settings]];
export default function ReputationShell({ children, title, description, actions }: { children: React.ReactNode; title: string; description: string; actions?: React.ReactNode }) {
  const path = usePathname();
  return <main className={styles.shell}><aside className={styles.sidebar}><Link href="/dashboard" className={styles.brand} prefetch><span>✦</span> PrimeReviews</Link><nav>{links.map(([href, label, Icon]) => <Link key={href} href={href} prefetch className={path === href ? styles.active : ""}><Icon />{label}</Link>)}</nav><div className={styles.sideNote}><span>PRIMEREVIEWS</span><p>Manage your review link, customer feedback, and local reputation in one place.</p></div></aside><section className={styles.workspace}><div className={styles.pageHeader}><div><h1>{title}</h1><p>{description}</p></div>{actions}</div>{children}</section></main>;
}
