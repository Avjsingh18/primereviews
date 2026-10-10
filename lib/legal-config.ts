// Details shown on the legal pages. Replace every value in [square brackets] with your real details, and have a
// qualified lawyer review the documents before you rely on them. `npm run build` warns while placeholders remain.
export const legal = {
  productName: "PrimeReviews",
  operator: "Amay Vikramjeet Singh, a sole proprietor trading as PrimeReviews",
  address: "Noida, Uttar Pradesh, India",
  contactEmail: "[support email address]",
  grievanceOfficer: "Amay Vikramjeet Singh, Founder",
  grievanceEmail: "[grievance email address]",
  courtsCity: "Noida, Uttar Pradesh",
  // Shown in the Privacy Policy for EEA/UK users. Leave "" until you actively serve people in the EU or UK without an office there;
  // the GDPR then usually requires an EU (and UK) representative, whose name and address go here.
  euUkRepresentative: "",
  effectiveDate: "10 October 2026",
  // Stored with every new account so you can show which version of the terms was accepted.
  termsVersion: "2026-10-10",
} as const;

export const legalLinks = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/acceptable-use", label: "Acceptable Use & Reviews Policy" },
] as const;

// Until a real email address is filled in above, the pages say it is coming rather than showing a bracketed placeholder.
const shown = (value: string) => (/^[^\s@\[\]]+@[^\s@\[\]]+\.[^\s@\[\]]+$/.test(value) ? value : "our support team (email address to be published shortly)");
export const contactEmail = shown(legal.contactEmail);
export const grievanceEmail = shown(legal.grievanceEmail);
