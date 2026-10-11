import type { Metadata } from "next";
import MarketingSite from "@/components/marketing-site";

export const metadata: Metadata = {
  title: "PrimeReviews: Google review QR codes for local businesses",
  description: "Create a QR code that sends customers straight to your Google review page. Track scans and ratings, compare with nearby businesses, and print designed QR cards.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return <MarketingSite />;
}
