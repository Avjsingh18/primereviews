"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, LoaderCircle, Printer, Sparkles } from "lucide-react";
import QRCode from "qrcode";
import ReputationShell from "./reputation-shell";

type Business = { name: string; googleReviewUrl: string; trackingUrl: string | null };
type AiDesign = { theme: string; backgroundDataUrl: string; qrDataUrl: string; generatedAt: string };
const api = "";

function absoluteUrl(value: string) { return new URL(value, window.location.origin).toString(); }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
async function createComposite(background: string, qr: string) {
  const [backgroundImage, qrImage] = await Promise.all([loadImage(background), loadImage(qr)]);
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1200;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(backgroundImage, 0, 0, 1200, 1200);
  context.fillStyle = "rgba(255,255,255,.96)"; context.beginPath(); context.roundRect(190, 190, 820, 820, 36); context.fill();
  context.drawImage(qrImage, 220, 220, 760, 760);
  return canvas.toDataURL("image/png");
}

export default function QRPage() {
  const [src, setSrc] = useState(""); const [baseQr, setBaseQr] = useState(""); const [copied, setCopied] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null); const [error, setError] = useState("");
  const [theme, setTheme] = useState(""); const [design, setDesign] = useState<AiDesign | null>(null); const [designing, setDesigning] = useState(false);
  const destination = business?.googleReviewUrl || ""; const payload = business?.trackingUrl || destination;

  useEffect(() => {
    const headers: Record<string, string> = {};
    fetch(`${api}/api/business`, { headers }).then(async (response) => {
      if (!response.ok) throw new Error(); const loaded = await response.json() as Business;
      if (!loaded.trackingUrl) { const response = await fetch(`${api}/api/business/qr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); if (!response.ok) throw new Error(); loaded.trackingUrl = (await response.json() as { trackingUrl: string }).trackingUrl; }
      loaded.trackingUrl = loaded.trackingUrl ? absoluteUrl(loaded.trackingUrl) : null; setBusiness(loaded);
      const qr = await QRCode.toDataURL(loaded.trackingUrl || loaded.googleReviewUrl, { width: 760, margin: 5, errorCorrectionLevel: "H", color: { dark: "#172033", light: "#ffffff" } }); setBaseQr(qr); setSrc(qr);
    }).catch(() => setError("We couldn’t load your business QR code. Please sign in again."));
  }, []);

  const createDesign = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setDesigning(true);
    try {
      const response = await fetch("/api/qr-design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme }) });
      const data = await response.json() as { design?: AiDesign; error?: string }; if (!response.ok || !data.design) throw new Error(data.error || "We couldn’t create the AI QR design.");
      const composite = await createComposite(data.design.backgroundDataUrl, data.design.qrDataUrl); setDesign(data.design); setSrc(composite);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t create the AI QR design."); } finally { setDesigning(false); }
  };
  const downloadSvg = async () => { if (!payload) return; const svg = await QRCode.toString(payload, { type: "svg", margin: 5, errorCorrectionLevel: "H", color: { dark: "#172033", light: "#ffffff" } }); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); anchor.download = `${business?.name || "review"}-google-review-qr.svg`; anchor.click(); URL.revokeObjectURL(anchor.href); };
  const downloadPng = () => { if (!src) return; const anchor = document.createElement("a"); anchor.href = src; anchor.download = `${business?.name || "review"}${design ? "-custom" : ""}-google-review-qr.png`; anchor.click(); };
  const copy = () => { navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return <ReputationShell title="Your Google review QR code" description={business ? `For ${business.name} — every scan opens your saved Google review page.` : "Loading your business QR code…"}>
    {error && <p className="form-error">{error}</p>}
    <section className="qr-layout">
      <div className={`card qr-card ${design ? "qr-card-designed" : ""}`} style={design ? { backgroundImage: `linear-gradient(rgba(24,28,59,.08),rgba(24,28,59,.08)), url(${design.backgroundDataUrl})` } : undefined}>
        <div className="review-mark">★ GOOGLE REVIEWS</div>{src ? <img src={src} alt={design ? "Custom restaurant-themed Google review QR code" : "Your Google review QR code"} /> : <div className="qr-placeholder" />}
        <h2>Enjoyed your experience?</h2><p>Scan to leave us a review on Google</p><div className="google">G <span>Google</span></div>
      </div>
      <div className="qr-actions">
        <section className="card ai-qr-card"><div className="ai-qr-heading"><span><Sparkles /></span><div><p className="eyebrow">AI QR STUDIO</p><h2>Match your restaurant’s atmosphere</h2></div></div><p>Describe the theme. We create a unique visual backdrop, then place a tested high-reliability QR code on top.</p>
          <form onSubmit={createDesign}><label htmlFor="qr-theme">Restaurant theme or style</label><textarea id="qr-theme" value={theme} onChange={(event) => setTheme(event.target.value)} maxLength={600} placeholder="Example: Warm terracotta café with plants, hand-thrown pottery and golden afternoon light." required minLength={8} /><div className="ai-qr-actions"><button className="button" disabled={designing || !payload} type="submit">{designing ? <LoaderCircle className="spin" /> : <Sparkles />}{designing ? "Creating your design…" : design ? "Create a new design" : "Create AI QR design"}</button>{design && <button className="outline" type="button" onClick={() => { setDesign(null); setSrc(baseQr); }}>Use clean QR</button>}</div></form>
          <small>The QR itself is generated by PrimeReviews—not AI-drawn—so it stays scannable. Your theme text is sent only to the image-generation service.</small>
        </section>
        <section className="card"><h2>Share your QR code</h2><p>{design ? "Your themed QR is ready to download or print." : "Put it at your counter, on receipts, or anywhere customers see it."}</p><div className="action-row"><button className="button" disabled={!src} onClick={downloadPng}><Download />Download PNG</button><button className="outline" disabled={!payload} onClick={downloadSvg}><Download />Clean SVG</button><button className="outline" onClick={() => window.print()}><Printer />Print</button></div></section>
        <section className="card details"><h2>Code details</h2><label>Google review URL <a href={destination} target="_blank" rel="noreferrer"><ExternalLink /></a></label><p>{destination || "Loading…"}</p><label>QR tracking URL</label><div className="copy-url"><code>{payload || "Loading…"}</code><button disabled={!payload} onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</button></div></section>
        <div className="tip"><b>Trackable, correct destination</b><span>This QR code records redirect visits (not unique people or completed reviews), then instantly redirects customers to your saved Google review URL.</span></div>
      </div>
    </section>
  </ReputationShell>;
}
