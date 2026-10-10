import type { Metadata } from "next";
import RecoveryScreen from "@/components/recovery-screen";

// The reset details arrive in the URL fragment or query; keep this page out of search results and never cache it.
export const metadata: Metadata = { title: "Choose a new password · PrimeReviews", robots: { index: false, follow: false } };
export default function ResetPasswordPage() { return <RecoveryScreen mode="reset" />; }
