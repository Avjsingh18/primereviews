import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { legal } from "@/lib/legal-config";

export const metadata: Metadata = { title: "Privacy Policy · PrimeReviews", description: "How PrimeReviews collects, uses, shares and protects personal data." };

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" summary="We collect only what we need to run your review QR code and dashboard. We do not sell personal data, show ads or use tracking cookies. This policy explains what we collect, why, who helps us run the service, how long we keep data and how you can exercise your rights.">
    <h2>1. Who we are</h2>
    <p>{legal.operator} (“we”, “us”, “our”) operates {legal.productName}, a service that helps local businesses collect Google reviews through a QR code, track scans and ratings, compare themselves with nearby businesses and create printable QR cards. Our address is {legal.address}. We are the data fiduciary (controller) for the personal data of people who create an account.</p>
    <p>This policy applies to our website, dashboard and QR links. It should be read with our <a href="/terms">Terms of Service</a> and <a href="/cookies">Cookie Policy</a>.</p>

    <h2>2. Information we collect</h2>
    <h3>Information you give us</h3>
    <ul>
      <li><b>Account details:</b> your name, business name, email address and password. Passwords are handled by our authentication provider; we never see or store your password in readable form.</li>
      <li><b>Business details:</b> your business name, business type, Google review link and the latitude and longitude of your business.</li>
      <li><b>QR card content:</b> the tagline you choose or write, your QR card design choices and, if you upload one, an ambience photo.</li>
      <li><b>Messages:</b> anything you send us when you contact us.</li>
    </ul>
    <h3>Information created when you use the service</h3>
    <ul>
      <li><b>QR scan counts:</b> when someone scans your QR code we add one to that day’s visit count for your QR code and redirect them to your Google review page. We do not store the visitor’s IP address, name or device details, and we try to exclude bots and link previews.</li>
      <li><b>Google rating data:</b> your current Google rating and review count, saved as a daily snapshot so charts can show change over time.</li>
      <li><b>Session and security data:</b> an encrypted session so you stay signed in, sign-in and sign-out times, and short-lived counters used to stop abuse. These counters are keyed hashes derived from your IP address or account, not the raw address.</li>
    </ul>
    <h3>Information from Google</h3>
    <p>We use the Google Places API to fetch public information such as ratings, review counts and nearby business listings. To do this we send your business location (and, for rankings, the business type you chose) to Google. We keep the results in a cache for up to 24 hours.</p>

    <h2>3. How we use information</h2>
    <ul>
      <li>To create and secure your account and provide the service you asked for.</li>
      <li>To show scan counts, ratings, competitor comparisons and your QR cards.</li>
      <li>To prevent fraud, abuse and security incidents, and to enforce our terms and Google’s review rules.</li>
      <li>To send service messages such as email confirmation and important notices.</li>
      <li>To maintain, debug and improve the service using aggregated, non-identifying information.</li>
      <li>To comply with law and respond to lawful requests.</li>
    </ul>
    <p>Our lawful bases are your consent, performing our contract with you, our legitimate interests in running and securing the service, and legal obligations. Where Indian law applies we process personal data on the basis of your consent and the other legitimate uses the law permits.</p>

    <h2>4. What we do not do</h2>
    <ul>
      <li>We do not sell or rent personal data.</li>
      <li>We do not show advertising or share data with advertisers or data brokers.</li>
      <li>We do not use advertising or analytics cookies or trackers at this time.</li>
      <li>We do not use your data or your uploaded photos to train AI models.</li>
    </ul>

    <h2>5. Who we share information with</h2>
    <p>We use trusted service providers to run {legal.productName}. They may process data only to provide their service to us:</p>
    <table><thead><tr><th>Provider</th><th>Purpose</th><th>Data involved</th></tr></thead><tbody>
      <tr><td>Supabase</td><td>Database and sign-in (hosted in the Mumbai region)</td><td>Account, business, scan-count, rating and QR card data</td></tr>
      <tr><td>Vercel</td><td>Website hosting and delivery</td><td>Requests to our website, technical logs</td></tr>
      <tr><td>Google (Places API)</td><td>Ratings, review counts and nearby businesses</td><td>Business location and business type</td></tr>
      <tr><td>Breached-password check (Have I Been Pwned)</td><td>Stops use of passwords found in public breaches</td><td>Only the first characters of a one-way hash of the password, never the password</td></tr>
    </tbody></table>
    <p>We may also disclose information if required by law, to protect rights, safety or the security of the service, or in connection with a merger, acquisition or sale of our business, in which case we will tell you before your data becomes subject to a different policy.</p>

    <h2>6. People who scan your QR code</h2>
    <p>{legal.productName} does not ask scanners for any personal details. After the scan is counted they are sent to Google, and Google’s own privacy policy applies to anything they do there, including writing a review. If you collect personal data from your customers in other ways, you are responsible for meeting your own privacy obligations to them.</p>

    <h2>7. International transfers</h2>
    <p>Our providers may process data in India and in other countries, including the United States. Where required, we rely on contractual protections and the transfer mechanisms permitted by applicable law.</p>

    <h2>8. How long we keep information</h2>
    <table><thead><tr><th>Information</th><th>Retention</th></tr></thead><tbody>
      <tr><td>Account, business and QR card data</td><td>While your account is active, then deleted or anonymised within a reasonable period after you close it, unless the law requires us to keep it</td></tr>
      <tr><td>Scan counts and rating snapshots</td><td>While your account is active, then deleted with it</td></tr>
      <tr><td>Uploaded photo</td><td>Until you remove or replace it, or close your account</td></tr>
      <tr><td>Sign-in sessions</td><td>Up to 7 days, or until you sign out or change your password</td></tr>
      <tr><td>Abuse-prevention counters</td><td>Short periods, typically minutes to a day</td></tr>
      <tr><td>Google data cache</td><td>Up to 24 hours</td></tr>
      <tr><td>Backups</td><td>Held by our providers for a limited period and then overwritten</td></tr>
    </tbody></table>

    <h2>9. Security</h2>
    <p>We use encrypted connections, encrypted session storage, access controls, rate limiting and other safeguards designed to protect personal data. No online service can be completely secure. If a personal data breach affects you, we will notify you and the relevant authorities as the law requires.</p>

    <h2>10. Your rights</h2>
    <p>Depending on where you live, you may have the right to access your personal data, correct it, have it erased, withdraw consent, nominate someone to exercise your rights if you die or become unable to, object to or restrict certain processing, receive a copy in a portable format and complain to a data protection authority. This includes your rights under India’s Digital Personal Data Protection Act, 2023 and, for people in the European Economic Area or the United Kingdom, the GDPR.</p>
    <p>You can correct most details and remove your photo in Settings. To exercise any other right, or to close your account and delete your data, email {legal.contactEmail}. We may need to verify your identity first and will respond within the time the law requires.</p>

    <h2>11. Children</h2>
    <p>{legal.productName} is for businesses and is not directed at anyone under 18. We do not knowingly collect personal data from children. If you believe a child has given us personal data, contact us and we will delete it.</p>

    <h2>12. Links to other sites</h2>
    <p>Our service links to Google and may link to other websites. We are not responsible for their content or privacy practices.</p>

    <h2>13. Changes to this policy</h2>
    <p>We may update this policy as the service or the law changes. We will post the new version here with a new effective date and, for material changes, tell you by email or in the dashboard.</p>

    <h2>14. Contact and Grievance Officer</h2>
    <p>For privacy questions or requests, contact {legal.operator}, {legal.address}, email {legal.contactEmail}.</p>
    <p>Grievance Officer: {legal.grievanceOfficer}, email {legal.grievanceEmail}. We aim to acknowledge complaints promptly and resolve them within the period required by law.</p>
  </LegalPage>;
}
