export const categories = {
  cafe: { label: "Cafés", nearbyTypes: ["cafe", "coffee_shop", "coffee_stand", "tea_house", "bakery"], textQueries: [] },
  restaurant: { label: "Restaurants", nearbyTypes: ["restaurant", "fast_food_restaurant", "food_court", "buffet_restaurant"], textQueries: [] },
  hotel: { label: "Hotels", nearbyTypes: ["hotel", "resort_hotel", "inn", "bed_and_breakfast"], textQueries: [] },
  pg: { label: "PG", nearbyTypes: ["hostel"], textQueries: ["PG", "paying guest", "student dormitory", "hostel", "lodge"] },
  salon: { label: "Salons", nearbyTypes: ["beauty_salon", "hair_salon", "hair_care", "barber_shop", "nail_salon", "beautician"], textQueries: [] },
  clinic: { label: "Clinics", nearbyTypes: ["medical_clinic", "doctor", "medical_center", "dental_clinic", "dentist", "skin_care_clinic", "physiotherapist"], textQueries: [] },
  "coaching-centre": { label: "Coaching centres", nearbyTypes: [], textQueries: ["coaching institute"] },
  "plant-nursery": { label: "Plant nurseries", nearbyTypes: ["garden_center"], textQueries: ["nursery"] },
  "day-care": { label: "Day care", nearbyTypes: ["child_care_agency"], textQueries: ["daycare", "baby care"] },
  preschool: { label: "Preschools", nearbyTypes: ["preschool"], textQueries: [] },
  gym: { label: "Gyms", nearbyTypes: ["gym", "fitness_center", "yoga_studio"], textQueries: [] },
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
