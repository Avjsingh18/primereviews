// Pricing is deliberately not invented: the product is free during early access and paid plans have no price yet.
export const pricingPlans = [
  { name: "Early access", price: "₹0", period: "while we are in early access", description: "Everything that is live today, for one business.", features: ["One Google review QR code", "QR Studio cards you can download as JPG", "Scan counts and rating charts", "Local rankings for your business type"], cta: "Start free", featured: true, comingSoon: false },
  { name: "Pro", price: "Coming soon", period: "", description: "For businesses that want more once the basics are working.", features: ["Everything in early access", "Several locations in one account", "Automated activity reports", "Google Business Profile connection"], cta: "Coming soon", featured: false, comingSoon: true },
] as const;
