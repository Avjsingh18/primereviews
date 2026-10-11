// Pricing is deliberately not invented: the product is free during early access and paid plans have no price yet.
export const pricingPlans = [
  { name: "Early access", price: "₹0", period: "while we are in early access", description: "Everything that is live today, for one business.", features: [], cta: "Start free", featured: true, comingSoon: false },
  { name: "Pro", price: "Coming soon", period: "", description: "For businesses that want more once the basics are working.", features: [], cta: "Coming soon", featured: false, comingSoon: true },
] as const;
