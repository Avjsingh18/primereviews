"use client";
import Link from "next/link";
import { Bot, FileText, LayoutDashboard, MapPin, QrCode, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import styles from "./reputation.module.css";

const links: Array<[string, string, typeof LayoutDashboard]> = [["/dashboard", "Dashboard", LayoutDashboard], ["/qr-code", "QR code", QrCode], ["/benchmark", "Local rankings", MapPin], ["/reviews", "Reviews", FileText], ["/ai-insights", "AI Insights", Bot], ["/settings", "Settings", Settings]];
export default function ReputationShell({ children, title, description, actions }: { children: React.ReactNode; title: string; description: string; actions?: React.ReactNode }) {
  const path = usePathname();
  return <main className={styles.shell}><aside className={styles.sidebar}><Link href="/dashboard" className={styles.brand}><span>✦</span> reviewflow</Link><nav>{links.map(([href, label, Icon]) => <Link key={href} href={href} className={path === href ? styles.active : ""}><Icon />{label}</Link>)}</nav><div className={styles.sideNote}><span>Local mode</span><p>Business details and manually recorded snapshots are stored in your local database.</p></div></aside><section className={styles.workspace}><div className={styles.pageHeader}><div><p className={styles.eyebrow}>REPUTATION MANAGEMENT</p><h1>{title}</h1><p>{description}</p></div>{actions}</div>{children}</section></main>;
}
