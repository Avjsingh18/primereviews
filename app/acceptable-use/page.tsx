import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { legal, contactEmail } from "@/lib/legal-config";

export const metadata: Metadata = { title: "Acceptable Use & Reviews Policy · PrimeReviews", description: "Rules for using PrimeReviews and collecting reviews honestly." };

export default function AcceptableUsePage() {
  return <LegalPage title="Acceptable Use & Reviews Policy" summary="Ask for reviews honestly. Do not pay for them, filter them, fake them or mislead people. These rules protect your customers, your business and your Google listing.">
    <h2>1. Collect reviews honestly</h2>
    <p>Google’s policies prohibit fake engagement and reviews that are not based on a real experience. When you use {legal.productName} you must:</p>
    <ul>
      <li><b>Not offer incentives.</b> Do not give or promise money, discounts, gifts, entries into draws or any other reward in exchange for a review, or for a positive review. {legal.productName} blocks taglines that offer rewards for reviews.</li>
      <li><b>Not gate reviews.</b> Do not ask customers about their experience first and send only happy customers to your review page. Your QR code must lead everyone to the same Google review page.</li>
      <li><b>Not post or buy fake reviews.</b> Do not write reviews yourself, have staff, relatives or friends write them as customers, or pay someone to do so.</li>
      <li><b>Not pressure or mislead.</b> Do not coerce customers, tell them what to write, or suggest a particular rating.</li>
      <li><b>Not discourage honest reviews.</b> Do not penalise or threaten customers over negative feedback.</li>
    </ul>

    <h2>2. Keep your QR code legitimate</h2>
    <ul>
      <li>Your saved link must be the genuine Google review page of a business you own or are authorised to represent.</li>
      <li>Do not use the QR code for phishing, spam, malware, adult content, scams or any unlawful purpose.</li>
      <li>Do not place the code on materials that are deceptive or that imitate another business.</li>
    </ul>

    <h2>3. Respect the law and other people</h2>
    <ul>
      <li>Do not upload photos, names or text that infringe copyright, trademarks, privacy or publicity rights, or that show identifiable customers without their permission.</li>
      <li>Do not upload unlawful, hateful, defamatory, harassing or sexually explicit content, or anything that exploits children.</li>
      <li>Taglines must not contain links, email addresses, phone numbers or profanity.</li>
    </ul>

    <h2>4. Protect the service</h2>
    <ul>
      <li>Do not attempt to bypass rate limits, security or access controls, probe for vulnerabilities without our written permission, or access accounts that are not yours.</li>
      <li>Do not inflate scan counts with scripts, bots or repeated automated visits.</li>
      <li>Do not scrape, resell or build a competing service from our data or the competitor information we show.</li>
      <li>Do not overload or disrupt the Service or the third-party services it uses.</li>
    </ul>

    <h2>5. Reporting problems</h2>
    <p>To report a misused QR code, content that infringes your rights, or a security issue, email {contactEmail} with enough detail for us to find it. We aim to review reports promptly and may remove content or disable QR codes while we do.</p>

    <h2>6. Enforcement</h2>
    <p>If we believe you have broken this policy, we may remove content, disable your QR code, suspend or close your account, and where required report to Google or the authorities. We may act without notice where needed to protect people or the Service. See our <a href="/terms">Terms of Service</a> for more.</p>
  </LegalPage>;
}
