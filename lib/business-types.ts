// Business types shown in onboarding and settings. Values match businesses.category_slug in the database.
export const BUSINESS_TYPES = [
  { value: "cafes", label: "Cafés" }, { value: "restaurants", label: "Restaurants" }, { value: "hotels", label: "Hotels" }, { value: "pg", label: "PG" },
  { value: "salons", label: "Salons" }, { value: "clinics", label: "Clinics" }, { value: "coaching_centres", label: "Coaching centres" }, { value: "plant_nurseries", label: "Plant nurseries" },
  { value: "day_care", label: "Day care" }, { value: "preschools", label: "Preschools" }, { value: "gyms", label: "Gyms" }, { value: "other", label: "Other" },
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];
export const isBusinessType = (value: unknown): value is BusinessType => BUSINESS_TYPES.some((type) => type.value === value);

// Competitor search category for each business type. "other" has no competitor category, so it never returns results.
export const COMPETITOR_CATEGORY: Record<BusinessType, string | null> = {
  cafes: "cafe", restaurants: "restaurant", hotels: "hotel", pg: "pg", salons: "salon", clinics: "clinic", coaching_centres: "coaching-centre",
  plant_nurseries: "plant-nursery", day_care: "day-care", preschools: "preschool", gyms: "gym", other: null,
};
