import "./globals.css";
import "./premium.css";
import "./help.css";
import "./settings.css";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = { title: "PrimeReviews", description: "Turn great visits into Google reviews." };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return <html lang="en"><body>{children}</body></html>;
}
