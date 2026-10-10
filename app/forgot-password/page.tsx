import type { Metadata } from "next";
import RecoveryScreen from "@/components/recovery-screen";

export const metadata: Metadata = { title: "Forgot password · PrimeReviews" };
export default function ForgotPasswordPage() { return <RecoveryScreen mode="forgot" />; }
