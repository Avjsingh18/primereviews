import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { legal } from "@/lib/legal-config";

export const metadata: Metadata = { title: "Cookie Policy · PrimeReviews", description: "The cookies PrimeReviews uses and why." };

export default function CookiesPage() {
  return <LegalPage title="Cookie Policy" summary="We use one essential cookie that keeps you signed in. We do not use advertising, analytics or tracking cookies.">
    <h2>1. What cookies are</h2>
    <p>Cookies are small text files that a website stores in your browser. Some are essential for a site to work; others are used for analytics or advertising.</p>
    <h2>2. The cookies we use</h2>
    <table><thead><tr><th>Name</th><th>Purpose</th><th>Type</th><th>Lifetime</th></tr></thead><tbody>
      <tr><td>prime_reviews_session (shown as __Host-prime_reviews_session on the live site)</td><td>Keeps you signed in. It holds a random identifier only; your sign-in details stay on our servers, encrypted. It is marked HttpOnly, Secure and SameSite so scripts and other sites cannot read it.</td><td>Strictly necessary, first-party</td><td>Up to 7 days, or until you sign out</td></tr>
    </tbody></table>
    <p>Because this cookie is strictly necessary to provide the service you request, it does not need your consent under most cookie laws. Without it you cannot sign in.</p>
    <h2>3. What we do not use</h2>
    <ul>
      <li>No advertising or retargeting cookies.</li>
      <li>No analytics or behaviour-tracking cookies or scripts at this time.</li>
      <li>No social media tracking pixels.</li>
    </ul>
    <p>If we add analytics or any non-essential cookies in future, we will update this policy and ask for your consent first where the law requires it.</p>
    <h2>4. Other storage</h2>
    <p>Our pages may keep short-lived items in your browser, such as an unsent form value, to make the site work. We do not use them to track you across sites. Pages we link to, including Google, set their own cookies under their own policies.</p>
    <h2>5. Your choices</h2>
    <p>You can block or delete cookies in your browser settings. If you block the essential cookie you will not be able to stay signed in. For more on how we handle personal data see our <a href="/privacy">Privacy Policy</a>.</p>
    <h2>6. Contact</h2>
    <p>Questions about cookies: {legal.contactEmail}.</p>
  </LegalPage>;
}
