"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Mail, Lock, Sparkles, User } from "lucide-react";

export default function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const signup = mode === "signup";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const body = signup
      ? { ownerName: form.get("name"), businessName: form.get("business"), email: form.get("email"), password: form.get("password") }
      : { email: form.get("email"), password: form.get("password") };

    try {
      const response = await fetch(`/api/auth/${signup ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "We couldn’t complete that request. Please try again.");
        return;
      }
      if (data.emailConfirmationRequired) {
        const email = typeof data.email === "string" ? data.email : String(body.email || "");
        setNotice(`Confirmation email sent to ${email}. Confirm your email to sign in.`);
        return;
      }
      // Credentials stay in HttpOnly cookies, never in JavaScript storage.
      localStorage.removeItem("reviewflow_token");
      localStorage.removeItem("reviewflow_business");
      localStorage.removeItem("prime_reviews_business");
      router.push(signup || data.onboardingRequired ? "/onboarding" : "/dashboard");
    } catch {
      setError("We couldn’t reach the secure service. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth">
    <Link className="brand" href="/"><span>✦</span> PrimeReviews</Link>
    <section className="auth-panel">
      <div className="auth-kicker"><Sparkles aria-hidden="true" />{signup ? "START FOR FREE" : "WELCOME BACK"}</div>
      <h1>{signup ? "Reviews, made remarkably easy." : "Welcome back."}</h1>
      <p className="muted">{signup ? "Create a share-ready review experience for every customer." : "Sign in to see what customers are saying."}</p>
      <form onSubmit={submit}>
        {signup && <><label>Your name<div><User /><input name="name" required placeholder="Alex Morgan" /></div></label><label>Business name<div><User /><input name="business" required placeholder="Melbourne Coffee House" /></div></label></>}
        <label>Email address<div><Mail /><input name="email" required type="email" placeholder="you@business.com" /></div></label>
        <label>Password<div><Lock /><input name="password" required minLength={signup ? 12 : 1} maxLength={signup ? 72 : 256} autoComplete={signup ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} placeholder={signup ? "At least 12 characters" : "Your password"} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} style={{ marginLeft: "auto", background: "none", border: 0, padding: 4, display: "grid", placeItems: "center", cursor: "pointer", color: "inherit" }}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        {!signup && <Link className="forgot" href="#">Forgot password?</Link>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status"><CheckCircle2 aria-hidden="true" />{notice}</p>}
        <button className="button auth-button" disabled={loading}>{loading ? "Please wait…" : signup ? "Create account" : "Sign in"}<ArrowRight /></button>
      </form>
      <p className="switch">{signup ? "Already have an account?" : "New to PrimeReviews?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create an account"}</Link></p>
    </section>
    <aside className="auth-aside" aria-label="PrimeReviews benefits">
      <div className="orb orb-one" /><div className="orb orb-two" />
      <div className="auth-proof"><span className="proof-star">★</span><span>Built for neighbourhood businesses</span></div>
      <div className="auth-visual" aria-hidden="true"><img src="/landing/sample-qr.jpg" alt="" width={840} height={1134} /><span className="auth-chip chip-a">★ 4.8 rating · sample</span><span className="auth-chip chip-b">+128 scans · sample</span></div>
      <div className="auth-aside-copy"><p>Turn every happy visit into a review worth sharing.</p><span>One QR code. Clear numbers. No busywork.</span></div>
      <div className="auth-stat"><strong>One scan</strong><span>opens your Google review page instantly</span></div>
    </aside>
  </main>;
}
