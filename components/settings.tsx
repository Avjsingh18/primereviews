"use client";

import { useEffect, useState } from "react";
import { Check, LifeBuoy, Link2, Lock, LogOut, MapPin, Save, Trash2 } from "lucide-react";
import BusinessFinder, { type PlaceChoice } from "./business-finder";
import ReputationShell from "./reputation-shell";
import { legal } from "@/lib/legal-config";
import { BUSINESS_TYPES, isBusinessType, type BusinessType } from "@/lib/business-types";

const api = "";

export default function Settings() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<BusinessType>("other");
  const [savedPlace, setSavedPlace] = useState<{ id: string; name: string; address: string | null } | null>(null);
  const [newPlace, setNewPlace] = useState<PlaceChoice | null>(null);
  const [changingPlace, setChangingPlace] = useState(false);
  const [message, setMessage] = useState("");
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false); const [deleteOpen, setDeleteOpen] = useState(false); const [deleteBusy, setDeleteBusy] = useState(false); const [deleteError, setDeleteError] = useState(""); const [deleteDone, setDeleteDone] = useState(false);
  const headers = () => ({ "Content-Type": "application/json" });

  useEffect(() => {
    fetch(`${api}/api/business`, { headers: headers() }).then((response) => response.json()).then((business) => {
      setName(business.name ?? ""); setUrl(business.googleReviewUrl ?? ""); if (isBusinessType(business.category)) setCategory(business.category);
      setSavedPlace(business.place ?? null);
    }).catch(() => setError("Please sign in again."));
  }, []);

  async function business(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    const response = await fetch(`${api}/api/business`, { method:"PUT", headers:headers(), body:JSON.stringify({ name, googleReviewUrl:url, category, ...(newPlace ? { placeId:newPlace.placeId } : {}) }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); return setError(typeof data.error === "string" ? data.error : "Enter a valid Google review URL."); }
    const saved = await response.json().catch(() => null);
    if (saved?.place) setSavedPlace(saved.place);
    setNewPlace(null); setChangingPlace(false);
    setMessage("Business details saved."); setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 3500);
  }

  async function password(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError(""); const form = new FormData(event.currentTarget);
    if (form.get("new") !== form.get("confirm")) return setError("New passwords do not match.");
    const response = await fetch(`${api}/api/auth/change-password`, { method:"POST", headers:headers(), body:JSON.stringify({ currentPassword:form.get("current"), newPassword:form.get("new") }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "Password could not be updated.");
    window.location.assign("/login");
  }
  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setDeleteError(""); setDeleteBusy(true); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${api}/api/auth/delete-account`, { method:"POST", headers:headers(), body:JSON.stringify({ password:form.get("delete-password"), confirm:form.get("delete-confirm") === "on" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your account could not be deleted.");
      localStorage.removeItem("reviewflow_token"); localStorage.removeItem("reviewflow_business"); localStorage.removeItem("prime_reviews_business");
      setDeleting(true); setDeleteDone(true);
      window.setTimeout(() => window.location.assign("/"), 2500);
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : "Your account could not be deleted."); }
    finally { setDeleteBusy(false); }
  }
  async function logout() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method:"POST", headers:headers(), body:"{}" });
      if (!response.ok) throw new Error();
      localStorage.removeItem("reviewflow_token");
      window.location.assign("/login");
    } catch { setError("Could not sign out securely. Please try again."); }
  }

  return <ReputationShell title="Account settings" description="Keep your review link, your Google business listing, and your account secure."><div className="settings">{savedToast ? <div className="settings-toast" role="status"><Check />Your details are saved.</div> : null}{error ? <p className="form-error">{error}</p> : null}{message ? <p className="settings-success"><Check />{message}</p> : null}
    <section className="card settings-card"><h2>Business details</h2><form onSubmit={business}><label>Business name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Business type<select value={category} onChange={(event) => setCategory(event.target.value as BusinessType)}>{BUSINESS_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Google review URL<input value={url} onChange={(event) => setUrl(event.target.value)} required type="url" /></label><div style={{ marginTop:18 }}><b style={{ fontSize:13 }}>Your business on Google</b><p className="muted" style={{ marginTop:4 }}>{savedPlace ? "This is the listing we use for your rating, review count and local rankings." : "Pick your business on Google so your rating is accurate and your local rankings work. You can do this from anywhere."}</p>{savedPlace && !changingPlace && !newPlace ? <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginTop:10, padding:"12px 14px", border:"1px solid rgba(31,27,46,.15)", borderRadius:12 }}><div><b style={{ fontSize:14 }}>{savedPlace.name}</b>{savedPlace.address ? <p className="muted" style={{ marginTop:2, fontSize:13 }}>{savedPlace.address}</p> : null}</div><button type="button" className="outline" onClick={() => setChangingPlace(true)}><MapPin />Change</button></div> : <BusinessFinder initialQuery={savedPlace ? "" : name} reviewUrl={url} selected={newPlace} onSelect={setNewPlace} />}</div><button className="button"><Save />Save business details</button></form></section>
    <section className="card settings-card"><h2>Change password</h2><form onSubmit={password}><label>Current password<input name="current" required type="password" autoComplete="current-password" /></label><label>New password<input name="new" required minLength={12} maxLength={72} type="password" autoComplete="new-password" /></label><label>Confirm new password<input name="confirm" required minLength={12} maxLength={72} type="password" autoComplete="new-password" /></label><button className="outline"><Lock />Update password</button></form></section>
    <section className="card settings-card"><h2>Google Business Profile</h2><p className="muted">Connect the Google account that manages this business to sync reviews and publish owner-approved replies.</p><button className="outline" disabled title="Google OAuth has not been configured yet"><Link2 />Connect Google Business Profile</button><p className="muted" style={{ fontSize:12, marginTop:12 }}>OAuth setup is required before this connection can be enabled.</p></section>
    <section className="card settings-card"><h2>Need support?</h2><p className="muted">Questions, a problem with your QR code, or something not working? Email us and we will get back to you.</p><a className="outline" style={{ textDecoration: "none" }} href={`mailto:${legal.contactEmail}?subject=${encodeURIComponent("PrimeReviews support")}`}><LifeBuoy />Email {legal.contactEmail}</a></section>
    <section className="card settings-card"><h2>Session</h2><p className="muted">Sign out to revoke this browser’s session immediately.</p><button type="button" className="outline" onClick={logout}><LogOut />Log out</button></section>
    <section className="card settings-card danger-zone"><h2>Delete account</h2>{deleteDone ? <p className="form-success" role="status"><Check />Your account and data have been deleted. Taking you to the home page…</p> : <><p className="muted">Permanently delete your account and everything in it: your business details, QR code and scan history, rating history, photo and settings. This cannot be undone, and printed QR codes will stop working.</p>{deleteOpen ? <form onSubmit={deleteAccount}><label>Enter your password to confirm<input name="delete-password" required type="password" autoComplete="current-password" maxLength={256} /></label><label className="danger-check"><input name="delete-confirm" type="checkbox" required /><span>I understand that my account and all of my data will be permanently deleted.</span></label>{deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}<div className="danger-actions"><button type="submit" className="danger-button" disabled={deleteBusy}><Trash2 />{deleteBusy ? "Deleting…" : "Permanently delete my account"}</button><button type="button" className="outline" onClick={() => { setDeleteOpen(false); setDeleteError(""); }} disabled={deleteBusy}>Cancel</button></div></form> : <button type="button" className="danger-button" onClick={() => setDeleteOpen(true)}><Trash2 />Delete my account…</button>}</>}</section>
  </div></ReputationShell>;
}
