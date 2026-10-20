"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";
import { ArrowLeft, ArrowRight, CheckCircle2, Link as LinkIcon } from "lucide-react";
import BusinessFinder, { type PlaceChoice } from "./business-finder";
import ReviewLinkHelp from "./review-link-help";

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(localStorageSafe("prime_reviews_business") || localStorageSafe("reviewflow_business"));
  const [category, setCategory] = useState<BusinessType>("restaurants");
  const [url, setUrl] = useState("");
  const [place, setPlace] = useState<PlaceChoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function next() {
    const businessName = nameRef.current?.value || name;
    const reviewUrl = urlRef.current?.value || url;
    if (step === 1) {
      if (!businessName.trim()) return setError("Enter your business name.");
      setName(businessName); setError(""); setStep(2); return;
    }
    if (step === 2) {
      if (!/^https?:\/\/.+/.test(reviewUrl)) return setError("Paste a valid Google review URL.");
      try {
        const response = await fetch("/api/business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: businessName, googleReviewUrl: reviewUrl, category }) });
        if (!response.ok) throw new Error();
        setUrl(reviewUrl); setError(""); setStep(3);
      } catch { setError("Couldn’t save your business. Please try again."); }
      return;
    }
    if (step === 3) {
      if (saving) return;
      setSaving(true);
      try {
        // Without a chosen business the owner can still finish; ratings and rankings simply wait until they pick one in Settings.
        if (place) {
          const response = await fetch("/api/business", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: businessName, googleReviewUrl: reviewUrl, category, placeId: place.placeId }) });
          if (!response.ok) { const data = await response.json().catch(() => ({})); setError(typeof data.error === "string" ? data.error : "Couldn’t save your business. Please try again."); return; }
        }
        const qrResponse = await fetch("/api/business/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (!qrResponse.ok) throw new Error();
        setError(""); setStep(4);
      } catch { setError("Couldn’t create your QR code. Please try again."); }
      finally { setSaving(false); }
      return;
    }
    router.push("/dashboard");
  }

  return <main className="onboard"><div className="onboard-top"><span className="brand"><span>✦</span> PrimeReviews</span><span>Step {step} of 4</span></div><div className="progress"><i style={{ width: `${step / 4 * 100}%` }} /></div><section>
    {step === 1 ? <><p className="eyebrow">LET’S GET STARTED</p><h1>What&apos;s your business called?</h1><p className="muted">This is the name your customers will see on your QR poster.</p><label>Business name<input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Melbourne Coffee House" autoFocus /></label><label>Business type<select value={category} onChange={(event) => setCategory(event.target.value as BusinessType)}>{BUSINESS_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><p className="muted">We use this to design your QR card and find similar businesses nearby.</p></> : null}
    {step === 2 ? <><p className="eyebrow">CONNECT GOOGLE</p><h1>Paste your Google review link</h1><p className="muted">Customers will be sent directly here — no forms or sign-in screens.</p><label>Google review URL<div className="input-icon"><LinkIcon /><input ref={urlRef} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://g.page/r/…/review" autoFocus /></div></label><small>Find this in your Google Business Profile → Ask for reviews.</small><ReviewLinkHelp /></> : null}
    {step === 3 ? <><p className="eyebrow">FIND YOUR BUSINESS</p><h1>Which business is yours?</h1><p className="muted">Search for your business on Google and pick it from the list. We use it to show your rating and compare you with similar businesses nearby. You can do this from anywhere, so you don&apos;t need to be at your shop.</p><BusinessFinder initialQuery={name} reviewUrl={url} selected={place} onSelect={setPlace} />{place ? null : <small>Can&apos;t find it? Use “Continue without it” and add it later in Settings.</small>}</> : null}
    {step === 4 ? <div className="success"><CheckCircle2 /><p className="eyebrow">YOU’RE READY</p><h1>Your review QR code is live.</h1><p className="muted">Your nearby benchmark is ready too — compare local businesses whenever you need.</p></div> : null}
    {error ? <p className="form-error">{error}</p> : null}
    <div className="onboard-actions">{step > 1 && step < 4 ? <button className="back" onClick={() => setStep(step - 1)}><ArrowLeft />Back</button> : <span />}<button className="button" onClick={next} disabled={saving}>{step === 4 ? "Go to dashboard" : step === 3 ? (place ? "Save and generate QR" : "Continue without it") : "Continue"}<ArrowRight /></button></div>
  </section></main>;
}

function localStorageSafe(key: string) { if (typeof window === "undefined") return ""; return localStorage.getItem(key) || ""; }
