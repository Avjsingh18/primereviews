"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import AuthAside from "./auth-aside";

type ResetLink = { accessToken?: string; tokenHash?: string };

export default function RecoveryScreen({ mode }: { mode: "forgot" | "reset" }) {
  const reset = mode === "reset";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [link, setLink] = useState<ResetLink | null | undefined>(undefined);
  const [expired, setExpired] = useState(false);
  const parsed = useRef(false);

  // Read the reset details from the link, keep them in memory only, then remove them from the address bar and history.
  useEffect(() => {
    if (!reset) { setExpired(new URLSearchParams(window.location.search).get("expired") === "1"); return; }
    // Read the link only once: the details are removed from the address bar below, so a second read would find nothing.
    if (parsed.current) return;
    parsed.current = true;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const accessToken = hash.get("type") === "recovery" ? hash.get("access_token") : null;
    const tokenHash = query.get("type") === "recovery" ? query.get("token_hash") : null;
    setLink(accessToken ? { accessToken } : tokenHash ? { tokenHash } : null);
    if (window.location.hash || window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [reset]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (!reset) {
        const email = String(form.get("email") || "");
        const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { setError(data.error || "We couldn’t send the email. Please try again."); return; }
        setSent(email); return;
      }
      if (form.get("new") !== form.get("confirm")) { setError("The two passwords do not match."); return; }
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...link, newPassword: form.get("new") }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error || "We couldn’t update your password. Please try again."); return; }
      window.location.assign("/login?reset=1");
    } catch { setError("We couldn’t reach the secure service. Please refresh and try again."); }
    finally { setLoading(false); }
  }

  const invalid = reset && link === null;
  return <main className="auth">
    <Link className="brand" href="/"><span>✦</span> PrimeReviews</Link>
    <section className="auth-panel">
      <div className="auth-kicker"><KeyRound aria-hidden="true" />{reset ? "NEW PASSWORD" : "RESET PASSWORD"}</div>
      {sent ? <>
        <h1>Check your email.</h1>
        <p className="muted">If an account exists for <b>{sent}</b>, we have sent a link to reset your password. It can take a few minutes, and the link expires after a short time. Check your spam folder too.</p>
        <p className="form-success" role="status"><CheckCircle2 aria-hidden="true" />Reset link requested.</p>
        <p className="switch"><Link href="/login">Back to sign in</Link></p>
      </> : invalid ? <>
        <h1>This link isn’t valid.</h1>
        <p className="muted">The reset link is missing, has expired or was already used. Request a new one and use it within a few minutes.</p>
        <Link className="button auth-button" href="/forgot-password">Request a new link<ArrowRight /></Link>
        <p className="switch"><Link href="/login">Back to sign in</Link></p>
      </> : reset && link === undefined ? <p className="muted">Checking your link…</p> : <>
        <h1>{reset ? "Choose a new password." : "Forgot your password?"}</h1>
        <p className="muted">{reset ? "Use at least 12 characters. You will be signed out everywhere and asked to sign in with the new password." : "Enter the email address you signed up with and we will send you a link to reset it."}</p>
        {expired && !reset ? <p className="form-error" role="alert">That reset link has expired. Request a new one below.</p> : null}
        <form onSubmit={submit}>
          {reset ? <>
            <label>New password<div><Lock /><input name="new" required minLength={12} maxLength={72} autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="At least 12 characters" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} style={{ marginLeft: "auto", background: "none", border: 0, padding: 4, display: "grid", placeItems: "center", cursor: "pointer", color: "inherit" }}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
            <label>Confirm new password<div><Lock /><input name="confirm" required minLength={12} maxLength={72} autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="Repeat the password" /></div></label>
          </> : <label>Email address<div><Mail /><input name="email" required type="email" autoComplete="email" placeholder="you@business.com" /></div></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button auth-button" disabled={loading}>{loading ? "Please wait…" : reset ? "Update password" : "Send reset link"}<ArrowRight /></button>
        </form>
        <p className="switch">Remembered it? <Link href="/login">Back to sign in</Link></p>
      </>}
    </section>
    <AuthAside />
  </main>;
}
