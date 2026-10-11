import "./globals.css";
import "./premium.css";
import "./help.css";
import "./settings.css";
import "./futuristic.css";
import type { Metadata } from "next";
import { connection } from "next/server";
import RecoveryRedirect from "@/components/recovery-redirect";

// A mistyped value must not take every page down, so fall back to the real domain.
function metadataOrigin() {
  try { return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://primereviews.in"); } catch { return new URL("https://primereviews.in"); }
}
export const metadata: Metadata = {
  metadataBase: metadataOrigin(),
  title: { default: "PrimeReviews", template: "%s" },
  description: "Turn great visits into Google reviews.",
  openGraph: { type: "website", siteName: "PrimeReviews", title: "PrimeReviews: Google review QR codes for local businesses", description: "Print a QR code, get more Google reviews, track scans and ratings, and see how you rank against nearby businesses." },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The proxy attaches a per-request CSP nonce. Nonce-aware Next scripts are
  // only emitted during dynamic rendering; without this gate, a prerendered
  // page has no nonce and the browser blocks the app scripts entirely.
  await connection();
  return <html lang="en"><body><RecoveryRedirect />{children}</body></html>;
}
