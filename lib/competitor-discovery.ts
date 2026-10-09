export const categories = {
  cafe: { label: "Cafés", googleType: "cafe" },
  restaurant: { label: "Restaurants", googleType: "restaurant" },
  hotel: { label: "Hotels", googleType: "lodging" },
  salon: { label: "Salons", googleType: "beauty_salon" },
  clinic: { label: "Clinics", googleType: "medical_clinic" },
  "coaching centre": { label: "Coaching centres", googleType: "school" },
  "plant nursery": { label: "Nurseries", googleType: "garden_center" },
  gym: { label: "Gyms", googleType: "gym" },
} as const;

export type Category = keyof typeof categories;
export type NearbySearchRequest = { latitude: number; longitude: number; category: Category; radiusKm: 1 | 3 | 5; limit: number };
export type Competitor = {
  id: string; name: string; category: string; rating: number | null; reviewCount: number | null; ratingSource: "google";
  address: string | null; latitude: number | null; longitude: number | null; distanceKm: number | null; distanceVerified: true;
  sourceUrl: null; googleMapsUrl: string | null; verificationStatus: "verified"; retrievedAt: string;
};
export type NearbySearchResponse = { businesses: Competitor[]; provider: "google_places"; sourceStatus: "verified"; isComplete: false; searchedAt: string };

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(lat2 - lat1); const deltaLongitude = radians(lon2 - lon1);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
