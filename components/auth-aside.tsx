export default function AuthAside() {
  return <aside className="auth-aside" aria-label="PrimeReviews benefits">
    <div className="orb orb-one" /><div className="orb orb-two" />
    <div className="auth-proof"><span className="proof-star">★</span><span>Built for neighbourhood businesses</span></div>
    <div className="auth-visual" aria-hidden="true"><img src="/landing/sample-qr.jpg" alt="" width={840} height={1134} /><span className="auth-chip chip-a">★ 4.8 rating · sample</span><span className="auth-chip chip-b">+128 scans · sample</span></div>
    <div className="auth-aside-copy"><p>Turn every happy visit into a review worth sharing.</p><span>One QR code. Clear numbers. No busywork.</span></div>
    <div className="auth-stat"><strong>One scan</strong><span>opens your Google review page instantly</span></div>
  </aside>;
}
