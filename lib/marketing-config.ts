export const pricingPlans = [
  { name: "Free", price: "₹0", description: "For trying PrimeReviews with one business.", features: ["One review QR code", "QR scan counter", "Edit your review link"], cta: "Start free", featured: false, comingSoon: false },
  { name: "Pro", price: "₹TBD", description: "Set this price before launch.", features: ["Everything in Free", "Scan history", "Review snapshots"], cta: "Start free", featured: true, comingSoon: false },
  { name: "Multi-location", price: "₹TBD", description: "Set this price before launch.", features: ["For teams with several locations", "Multiple locations", "Automated reports"], cta: "Talk to us", featured: false, comingSoon: true },
] as const;
