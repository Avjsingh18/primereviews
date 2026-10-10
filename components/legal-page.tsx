import Link from "next/link";
import type { ReactNode } from "react";
import { legal, legalLinks } from "@/lib/legal-config";
import styles from "./legal.module.css";

export function LegalLinks({ className }: { className?: string }) {
  return <nav className={className} aria-label="Legal">{legalLinks.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>;
}

export default function LegalPage({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return <main className={styles.page}>
    <header className={styles.top}><Link href="/" className={styles.logo}><span>✦</span> {legal.productName}</Link><Link href="/" className={styles.back}>Back to home</Link></header>
    <article className={styles.doc}>
      <p className={styles.kicker}>LEGAL</p>
      <h1>{title}</h1>
      <p className={styles.meta}>Effective {legal.effectiveDate} · Version {legal.termsVersion}</p>
      <p className={styles.summary}>{summary}</p>
      {children}
      <p className={styles.contact}>Questions about this document? Contact {legal.operator} at {legal.contactEmail}.</p>
    </article>
    <footer className={styles.foot}><LegalLinks className={styles.footLinks} /><p>© {new Date().getFullYear()} {legal.operator}. {legal.productName} is not affiliated with, endorsed by or sponsored by Google.</p></footer>
  </main>;
}
