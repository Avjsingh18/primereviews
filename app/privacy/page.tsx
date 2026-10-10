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
      <li><b>Account details:</b> your name, business name and email address. Your password is sent to our authentication provider, which keeps only a secure one-way hash; we do not store your password. We also record when you accepted these Terms and which version.</li>
      <li><b>Business details:</b> your business name, business type, Google review link and your business location (latitude and longitude). You can type the location or, if you press “Use my location”, share it through your browser, which asks your permission first.</li>
      <li><b>QR card content:</b> the tagline you choose or write, your design choices (design style and black-and-white mode) and, if you upload one, an ambience photo or the ready-made background you select. Uploaded photos have their metadata removed and are compressed before we store them.</li>
      <li><b>Messages:</b> anything you send us when you contact us.</li>
    </ul>
    <h3>Information created when you use the service</h3>
    <ul>
      <li><b>QR scan counts:</b> when someone scans your QR code we add one to that day’s visit count for your QR code and redirect them to your Google review page. The count is stored on its own, as a number per QR code per day. We do not store the visitor’s IP address, name or device details with it, and we try to exclude bots and link previews. We read the visitor’s browser type at that moment only to tell bots from people, and we do not store it.</li>
      <li><b>Google rating data:</b> your current Google rating and review count, saved as a daily snapshot so charts can show change over time, and recent Google results (see below) kept in a cache for up to 24 hours.</li>
      <li><b>Session and security records:</b> a random session identifier and encrypted sign-in tokens so you stay signed in, plus security records such as the time of your last password change and a short temporary lock that is used while a password change is being processed.</li>
      <li><b>Your QR link:</b> your QR code contains a public short link. Its address includes a short identifier based on your business name, and anyone who opens it is redirected to your Google review link.</li>
    </ul>
    <h3>Technical data and IP addresses</h3>
    <p>Like every website, our servers receive your IP address, browser type and the pages you request each time you visit us or scan a QR code. We use the IP address (and, for sign-in and sign-up limits, your email address or account identifier) only for security and to prevent abuse: it is turned into a keyed, one-way hash that is used to count requests and apply rate limits, and those hashes are deleted after a short period of inactivity. We do not store IP addresses in readable form in our application database. However, the hosting, database and authentication providers that deliver our service handle IP addresses and request details as part of normal operation, and may keep them in their own security and operational logs for a limited time under their own policies.</p>
    <h3>Information we send to and receive from Google</h3>
    <p>We use the Google Places API server-side. To find your business and your Google rating we send Google your business name and location. To build the local rankings we send your business location and search keywords for the business type you chose. We receive public information such as ratings, review counts, business names, addresses, distances and map links of nearby businesses. We do not send your name, email address or password to Google.</p>

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
    <table><thead><tr><th>Category of provider</th><th>Purpose</th><th>Data involved</th></tr></thead><tbody>
      <tr><td>Cloud hosting and delivery providers</td><td>Run and deliver our website and QR links</td><td>Requests to our service, including IP address and technical logs</td></tr>
      <tr><td>Database and authentication providers</td><td>Store your account and sign you in</td><td>Account, business, scan-count, rating and QR card data</td></tr>
      <tr><td>Google (Places API)</td><td>Ratings, review counts and nearby businesses</td><td>Business location and business type</td></tr>
      <tr><td>Breached-password checking service</td><td>Stops use of passwords found in public breaches</td><td>Only the first characters of a one-way hash of the password, never the password itself</td></tr>
      <tr><td>Email delivery providers</td><td>Send confirmation and service emails</td><td>Your email address and the message</td></tr>
    </tbody></table>
    <p>We may also disclose information if required by law, to protect rights, safety or the security of the service, or in connection with a merger, acquisition or sale of our business, in which case we will tell you before your data becomes subject to a different policy.</p>

    <h2>6. People who scan your QR code</h2>
    <p>{legal.productName} does not ask scanners for any personal details and does not store their IP address or device details with the scan count. The request does pass through our infrastructure, so the technical handling described in section 2 applies to it. After the scan is counted they are sent to Google, and Google’s own privacy policy applies to anything they do there, including writing a review. If you collect personal data from your customers in other ways, you are responsible for meeting your own privacy obligations to them.</p>

    <h2>7. International use and transfers</h2>
    <p>{legal.productName} is available internationally. We and our providers may process and store your data in India, the United States, the European Union and other countries where those providers operate, which may have data protection laws different from those where you live. Where the law requires it, we use appropriate safeguards for these transfers, such as standard contractual clauses, and we require providers to protect data to a comparable standard.</p>

    <h2>8. How long we keep information</h2>
    <table><thead><tr><th>Information</th><th>Retention</th></tr></thead><tbody>
      <tr><td>Account, business and QR card data</td><td>While your account is active. When you delete your account in Settings, it is deleted from our systems straight away, unless the law requires us to keep something; copies in provider backups are overwritten over time</td></tr>
      <tr><td>Daily scan counts</td><td>Up to 2 years on a rolling basis, or until you delete your account if sooner</td></tr>
      <tr><td>Rating snapshots</td><td>While your account is active, then deleted with it when you delete your account</td></tr>
      <tr><td>Uploaded photo or selected background</td><td>Until you remove or replace it, or delete your account</td></tr>
      <tr><td>Sign-in sessions</td><td>Up to 7 days, or until you sign out or change your password</td></tr>
      <tr><td>Abuse-prevention hashes</td><td>Deleted after about 2 days of inactivity</td></tr>
      <tr><td>Google results cache</td><td>Up to 24 hours</td></tr>
      <tr><td>Provider logs and backups</td><td>Held by our providers for a limited period under their own policies</td></tr>
    </tbody></table>

    <h2>9. Security</h2>
    <p>We use encrypted connections, encrypted session storage, access controls, rate limiting and other safeguards designed to protect personal data. No online service can be completely secure. If a personal data breach affects you, we will notify you and the relevant authorities as the law requires.</p>

    <h2>10. Your rights</h2>
    <p>Depending on where you live, you may have the right to access your personal data, correct it, have it erased, withdraw consent, nominate someone to exercise your rights if you die or become unable to, object to or restrict certain processing, receive a copy in a portable format and complain to a data protection authority. This includes your rights under India’s Digital Personal Data Protection Act, 2023 and, for people in the European Economic Area or the United Kingdom, the GDPR.</p>
    <p>You can correct most details and remove your photo in Settings, and you can delete your account and all of your data yourself in Settings under “Delete account” (you will be asked for your password). To exercise any other right, email {legal.contactEmail}. We may need to verify your identity first and will respond within the time the law requires.</p>

    <h3>Additional information for certain regions</h3>
    <ul>
      <li><b>European Economic Area and United Kingdom:</b> we process personal data on the legal bases described in section 3. You may lodge a complaint with your local data protection authority. {legal.euUkRepresentative}</li>
      <li><b>California and other US states:</b> we do not sell your personal information or share it for cross-context behavioural advertising, and we do not use or disclose sensitive personal information for purposes that require an opt-out. The categories of personal information we collect are described in section 2 and our purposes in section 3. You may request to know, access, correct or delete your information, and we will not discriminate against you for doing so.</li>
      <li><b>Other countries:</b> if the law where you live gives you additional rights over your personal data (for example in Canada, Brazil, Australia, Singapore or the Gulf states), we will honour them where they apply to us. Contact us to make a request.</li>
    </ul>
    <p>If you use {legal.productName} on behalf of a business and add personal data of other people, you are responsible for having a lawful basis to do so. Businesses that need a data processing agreement can contact us.</p>

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
