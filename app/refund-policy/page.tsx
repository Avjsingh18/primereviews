import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { legal, contactEmail } from "@/lib/legal-config";

export const metadata: Metadata = { title: "Refund & Cancellation Policy · PrimeReviews", description: "How subscriptions, cancellation and refunds work at PrimeReviews." };

export default function RefundPolicyPage() {
  return <LegalPage title="Refund & Cancellation Policy" summary="Paid plans are monthly subscriptions. You can cancel at any time and keep using the paid features until the end of the month you have already paid for. We do not refund a month that has already started, except in the cases listed below.">
    <h2>1. Free early access</h2>
    <p>While {legal.productName} is in early access, it is free and nothing on this page involves a payment. This policy applies once paid plans are available and you choose to subscribe.</p>

    <h2>2. How paid plans work</h2>
    <ul>
      <li><b>Monthly subscription.</b> A paid plan is billed monthly, in advance, for each billing period. The price, currency and any taxes are shown before you pay.</li>
      <li><b>What the subscription includes.</b> While your subscription is active, your QR code sends customers to your Google review link and the local ranking feature is available. Other paid features are listed on the pricing page.</li>
      <li><b>What happens without a subscription.</b> If you have no active paid plan, your QR code will not redirect customers to your review link, and paid features such as local ranking are switched off. Printed QR cards will show a notice instead of taking customers to your review page until you subscribe again. Plan your printed materials with this in mind.</li>
    </ul>

    <h2>3. Cancelling</h2>
    <ul>
      <li>You can cancel your subscription at any time from your account, or by emailing {contactEmail}.</li>
      <li><b>You keep access for the month you paid for.</b> If you cancel part-way through a billing period, your plan and its features stay active until that period ends. We will not charge you again after that.</li>
      <li>When the period ends, the paid features stop as described in section 2. Your account and data stay in place under our <a href="/privacy">Privacy Policy</a> unless you delete your account, and subscribing again turns the paid features back on.</li>
      <li>Cancelling stops future charges. It does not delete your account. To delete your account and data, use Settings → Delete account.</li>
    </ul>

    <h2>4. Refunds</h2>
    <p>Because you can cancel at any time and keep access until the end of the paid month, we do not give refunds or part-refunds for a billing period that has started, and we do not refund unused days after you cancel. We will refund you in these cases:</p>
    <ul>
      <li><b>Duplicate or incorrect charge.</b> You were charged twice for the same period, or charged an amount different from what was shown.</li>
      <li><b>Charge after cancellation.</b> You cancelled before the renewal date and were still charged.</li>
      <li><b>Where the law requires.</b> If the law where you live gives you a right to a refund, we will honour it.</li>
    </ul>
    <p>We cannot refund for: not getting a number of reviews or a particular rating, Google removing or changing reviews or listings, forgetting to cancel before renewal, or a QR code that stopped working because your subscription had ended.</p>

    <h2>5. Outages</h2>
    <p>If the paid features are unavailable because of a fault on our side for more than 24 hours in a row, we will extend your subscription by the number of days affected. We do not give a refund for outages. Outages caused by Google, your internet connection or device, or maintenance we announce in advance do not count.</p>

    <h2>6. How to ask for a refund</h2>
    <p>Email {contactEmail} within 7 days of the charge with the email address on your account, the date and amount of the payment, and what went wrong. We aim to reply within 3 working days.</p>

    <h2>7. How refunds are paid</h2>
    <p><b>You get back the full amount you paid for the refunded charge.</b> That includes any taxes on it and the part taken by our payment provider as its processing fee. We do not deduct fees or charges from an approved refund.</p>
    <p>Approved refunds go back to the original payment method (for example the same UPI account or card) through our payment provider. Banks usually take about 5 to 10 working days to show them. We cannot send a refund to a different account or in another form.</p>

    <h2>8. Taxes and failed payments</h2>
    <p>Prices may include or add taxes such as GST or VAT, as shown at checkout. If a renewal payment fails, we may retry it and, if it still fails, end the paid plan. Charges that fail are not owed.</p>

    <h2>9. Price changes</h2>
    <p>We may change prices for future billing periods. We will tell you before the change takes effect, and you can cancel before it applies. The new price will not apply to a period you have already paid for.</p>

    <h2>10. Changes to this policy</h2>
    <p>We may update this policy. Changes do not affect a billing period you have already paid for.</p>

    <h2>11. Contact</h2>
    <p>{legal.operator}, {legal.address}. Email: {contactEmail}.</p>
  </LegalPage>;
}
