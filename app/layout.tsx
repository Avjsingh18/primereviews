import "./globals.css";
import "./premium.css";
import "./help.css";
import "./settings.css";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = { title: "PrimeReviews", description: "Turn great visits into Google reviews." };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The proxy attaches a per-request CSP nonce. Nonce-aware Next scripts are
  // only emitted during dynamic rendering; without this gate, a prerendered
  // page has no nonce and the browser blocks the app scripts entirely.
  await connection();
  return <html lang="en"><body>{children}</body></html>;
}
