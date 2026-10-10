import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { legal, contactEmail } from "@/lib/legal-config";

export const metadata: Metadata = { title: "Terms of Service · PrimeReviews", description: "The terms that apply when you use PrimeReviews." };

export default function TermsPage() {
  return <LegalPage title="Terms of Service" summary="These terms are a legal agreement between you and us. In short: use the service honestly and lawfully, follow Google’s review rules, keep your account secure, and understand that we cannot guarantee reviews, ratings or results. Please read them carefully.">
    <h2>1. Agreement</h2>
    <p>These Terms of Service (“Terms”) govern your access to and use of {legal.productName}, operated by {legal.operator} (“we”, “us”, “our”), including our website, dashboard, QR links, QR Studio and related features (the “Service”). By creating an account, ticking the box to accept these Terms, or using the Service, you agree to these Terms, our <a href="/privacy">Privacy Policy</a>, our <a href="/cookies">Cookie Policy</a> and our <a href="/acceptable-use">Acceptable Use & Reviews Policy</a>. If you do not agree, do not use the Service.</p>
    <p>You must be at least 18 years old and able to form a binding contract. If you use the Service for a business, you confirm that you have authority to bind that business, and “you” includes it.</p>

    <h2>2. The Service</h2>
    <p>The Service lets you create a QR code that sends customers to the Google review link you provide, count visits to that link, view Google ratings and review counts, compare yourself with nearby businesses, and design printable QR cards. Features marked “Coming soon” are plans, not promises. We may add, change or remove features at any time, and parts of the Service may be offered as early access or beta.</p>

    <h2>3. Your account</h2>
    <ul>
      <li>Give accurate information and keep it up to date.</li>
      <li>Keep your password confidential and tell us promptly if you suspect unauthorised use. You are responsible for activity under your account.</li>
      <li>One account is intended for one business. Do not share an account in a way that breaks these Terms.</li>
    </ul>

    <h2>4. Acceptable use</h2>
    <p>You must follow our <a href="/acceptable-use">Acceptable Use & Reviews Policy</a>. In particular you must not use the Service to post fake or misleading reviews, to offer rewards for reviews, to filter who may leave a review, to break the law, to infringe anyone’s rights, to harm or overload the Service, or to point your QR code anywhere other than a genuine Google review page for your own business.</p>

    <h2>5. Google and other third-party services</h2>
    <p>The Service works with Google and other third parties. {legal.productName} is independent and is not affiliated with, endorsed by or sponsored by Google. “Google”, “Google Maps” and related marks belong to Google LLC. Ratings, review counts and business listings come from Google and may be delayed, incomplete or inaccurate; we do not control them. Your use of Google services is subject to Google’s own terms and policies, including its policies on reviews, and you are responsible for complying with them. Google may remove reviews, change ratings or suspend listings at its discretion, and we are not responsible for those decisions.</p>

    <h2>6. Review collection is your responsibility</h2>
    <p>You decide how and when to ask customers for reviews. You are solely responsible for making sure your practices comply with Google’s policies and with applicable consumer-protection, advertising and privacy laws, including laws about fake, incentivised or selectively gated reviews. A QR scan records a visit to your review link; it does not mean a review was written.</p>

    <h2>7. Your content</h2>
    <p>“Your Content” means information and files you provide, such as your business name, review link, location, taglines and photos. You keep ownership of Your Content. You give us a worldwide, non-exclusive, royalty-free licence to host, process, adapt (for example resize and compress photos) and display Your Content solely to provide and secure the Service for you. You confirm that you have all rights and consents needed for Your Content, that it does not infringe anyone’s rights or identify customers without their permission, and that it is lawful. You can remove your photo at any time and delete your account.</p>

    <h2>8. Our property and QR cards</h2>
    <p>The Service, its software, designs, text, icons and layouts belong to us or our licensors and are protected by law. We give you a limited, revocable, non-exclusive, non-transferable right to use the Service and to print and display the QR cards you create for your own business. You may not copy, resell, reverse engineer or build a competing service from the Service, or remove notices from it.</p>

    <h2>9. AI-generated images</h2>
    <p>Some images we provide, including sample images on our website and ready-made QR card backgrounds, are generated with artificial intelligence. They are illustrative and are not photographs of your business or of real people. You are responsible for deciding whether an image is suitable and not misleading for your business.</p>

    <h2>10. Fees</h2>
    <p>The Service is currently free while in early access. If we introduce paid plans we will tell you in advance, show prices and billing terms before you pay, and will not charge you without your agreement. Taxes may apply to paid plans.</p>

    <h2>11. Availability and changes</h2>
    <p>We work to keep the Service available but do not promise uninterrupted or error-free operation. We may suspend or change the Service for maintenance, security or legal reasons. QR codes depend on your printed materials, lighting and customers’ devices; test every printed code before you rely on it.</p>

    <h2>12. Disclaimers</h2>
    <p>To the fullest extent permitted by law, the Service is provided “as is” and “as available”, without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, accuracy and non-infringement. We do not guarantee that you will receive any number of reviews, any rating, any increase in customers or revenue, or that data from Google or other sources is accurate or complete.</p>

    <h2>13. Limitation of liability</h2>
    <p>To the fullest extent permitted by law, we and our directors, employees, partners and suppliers will not be liable for any indirect, incidental, special, consequential, exemplary or punitive damages, or for loss of profits, revenue, goodwill, data or business opportunity, arising from or related to the Service or these Terms, even if we were told it was possible. Our total liability for any claim relating to the Service is limited to the greater of the amount you paid us in the 12 months before the claim and ₹1,000. Nothing in these Terms excludes liability that cannot be excluded by law, including liability for fraud or for death or personal injury caused by negligence.</p>

    <h2>14. Indemnity</h2>
    <p>You agree to defend and indemnify us and our affiliates, directors, employees and suppliers against claims, damages, losses and expenses (including reasonable legal fees) arising out of Your Content, your use of the Service, your review-collection practices, your breach of these Terms or of any law, or your infringement of any right.</p>

    <h2>15. Suspension and termination</h2>
    <p>You may stop using the Service and delete your account at any time in Settings; deleting it permanently removes your data, and printed QR codes stop working. We may suspend or end your access, disable your QR code or remove content immediately, with or without notice, if we believe you breached these Terms or the law, if required by law or by Google, to protect the Service or others, or if your account is inactive. When your account ends your right to use the Service stops, and we will handle your data as described in the Privacy Policy. Sections that by their nature should survive (including ownership, disclaimers, liability limits, indemnity and governing law) will survive.</p>

    <h2>16. Privacy</h2>
    <p>Our <a href="/privacy">Privacy Policy</a> explains how we handle personal data and forms part of these Terms.</p>

    <h2>17. Changes to these Terms</h2>
    <p>We may update these Terms. We will post the new version here with a new effective date and, for material changes, notify you by email or in the dashboard. If you keep using the Service after the change takes effect you accept the new Terms. If you do not agree, stop using the Service and close your account.</p>

    <h2>18. Governing law and disputes</h2>
    <p>These Terms are governed by the laws of India. Please contact us first so we can try to resolve any dispute informally. Subject to any mandatory rights you have under the law of the country where you live, the courts at {legal.courtsCity}, India have exclusive jurisdiction over disputes relating to these Terms or the Service.</p>

    <h2>19. Use outside India, business use and compliance</h2>
    <p>The Service is intended for businesses, not for personal or household use by consumers. {legal.productName} can be accessed from many countries, but you are responsible for complying with the laws that apply to you where you use it, including laws about advertising, reviews, consumer protection, privacy and taxes. You may not use the Service if you are barred from doing so by applicable export-control or sanctions laws, or if you are located in, or ordinarily resident in, a country or region subject to comprehensive sanctions. Any taxes, duties or levies that apply to paid plans, such as GST or VAT, are your responsibility unless we state otherwise.</p>

    <h2>20. General</h2>
    <ul>
      <li><b>Entire agreement:</b> these Terms and the policies they refer to are the whole agreement about the Service.</li>
      <li><b>Severability:</b> if a provision is unenforceable, the rest remains in effect.</li>
      <li><b>No waiver:</b> not enforcing a provision is not a waiver of it.</li>
      <li><b>Assignment:</b> you may not transfer your rights without our consent; we may transfer ours in a merger, acquisition or sale of our business.</li>
      <li><b>Electronic communications:</b> you agree we may contact you electronically and that this satisfies any legal requirement to write.</li>
      <li><b>Events beyond our control:</b> we are not liable for delays or failures caused by events outside our reasonable control, including outages of third-party services.</li>
    </ul>

    <h2>21. Contact</h2>
    <p>{legal.operator}, {legal.address}. Email: {contactEmail}.</p>
  </LegalPage>;
}
