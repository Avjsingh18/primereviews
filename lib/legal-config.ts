// Details shown on the legal pages. Replace every value in [square brackets] with your real details, and have a
// qualified lawyer review the documents before you rely on them. `npm run build` warns while placeholders remain.
export const legal = {
  productName: "PrimeReviews",
  operator: "[Registered business name]",
  address: "[Registered office address, city, state, PIN code, India]",
  contactEmail: "[support email address]",
  grievanceOfficer: "[Name and designation of Grievance Officer]",
  grievanceEmail: "[grievance email address]",
  courtsCity: "[City]",
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
