"use client";
import Link from "next/link";
import { Bot, FileText, LayoutDashboard, MapPin, QrCode, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import type { PointerEvent } from "react";
import styles from "./reputation.module.css";
import { LegalLinks } from "./legal-page";

const links: Array<[string, string, typeof LayoutDashboard]> = [["/dashboard", "Dashboard", LayoutDashboard], ["/qr-code", "QR code", QrCode], ["/benchmark", "Local rankings", MapPin], ["/reviews", "Reviews", FileText], ["/ai-insights", "AI Insights", Bot], ["/settings", "Settings", Settings]];
export default function ReputationShell({ children, title, description, actions }: { children: React.ReactNode; title: string; description: string; actions?: React.ReactNode }) {
  const path = usePathname();
  // Moves the soft highlight on whichever card the pointer is over (see futuristic.css).
  const glow = (event: PointerEvent<HTMLElement>) => { const card = (event.target as HTMLElement).closest("article") as HTMLElement | null; if (!card) return; const box = card.getBoundingClientRect(); card.style.setProperty("--gx", `${event.clientX - box.left}px`); card.style.setProperty("--gy", `${event.clientY - box.top}px`); };
  return <main className={styles.shell} onPointerMove={glow}><aside className={styles.sidebar}><Link href="/dashboard" className={styles.brand} prefetch><span>✦</span> PrimeReviews</Link><nav>{links.map(([href, label, Icon]) => <Link key={href} href={href} prefetch className={path === href ? styles.active : ""}><Icon />{label}</Link>)}</nav><div className={styles.sideNote}><span>PRIMEREVIEWS</span><p>Manage your review link, customer feedback, and local reputation in one place.</p></div></aside><section className={styles.workspace} data-fx="rise"><div className={styles.pageHeader}><div><h1>{title}</h1><p>{description}</p></div>{actions}</div>{children}<LegalLinks className="app-legal" /></section></main>;
}
