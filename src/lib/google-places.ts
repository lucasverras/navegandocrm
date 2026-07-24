import { CATEGORIES, type Category } from "@/types/domain";

const PLACES_BASE = "https://places.googleapis.com/v1";

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function geocodeRegion(query: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query
  )}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) return null;

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

export interface PlaceResult {
  placeId: string;
  name: string;
  category: Category;
  address: string | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  lat: number | null;
  lng: number | null;
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Searches one category around a lat/lng using the Places API (New) Nearby Search.
// Only requests/saves the compact field set we actually use — never raw HTML or full pages.
export async function searchNearbyByCategory(
  lat: number,
  lng: number,
  radiusMeters: number,
  category: Category
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const res = await fetch(`${PLACES_BASE}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber," +
        "places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.priceLevel," +
        "places.location,places.businessStatus",
    },
    body: JSON.stringify({
      includedTypes: [category],
      maxResultCount: 20,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Places search failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const places = (data.places ?? []) as Record<string, unknown>[];

  return places
    .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY")
    .map((p) => {
      const location = p.location as { latitude?: number; longitude?: number } | undefined;
      const displayName = p.displayName as { text?: string } | undefined;
      return {
        placeId: p.id as string,
        name: displayName?.text ?? "Sem nome",
        category,
        address: (p.formattedAddress as string) ?? null,
        phone: (p.nationalPhoneNumber as string) ?? null,
        website: (p.websiteUri as string) ?? null,
        mapsUrl: (p.googleMapsUri as string) ?? null,
        rating: (p.rating as number) ?? null,
        reviewCount: (p.userRatingCount as number) ?? null,
        priceLevel: p.priceLevel ? PRICE_LEVEL_MAP[p.priceLevel as string] ?? null : null,
        lat: location?.latitude ?? null,
        lng: location?.longitude ?? null,
      };
    });
}

export function dedupePlaces(results: PlaceResult[]): PlaceResult[] {
  const seen = new Map<string, PlaceResult>();
  for (const r of results) {
    if (!seen.has(r.placeId)) seen.set(r.placeId, r);
  }
  return Array.from(seen.values());
}

export { CATEGORIES };
