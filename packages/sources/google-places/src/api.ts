import {
  COST_NEARBY_USD,
  COST_DETAILS_USD,
  type GooglePlaceNearby,
  type NearbySearchResponse,
} from "./types.js";

const NEARBY_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

/** Redacts the API key from a URL or string for safe logging. */
export function redactKey(value: string): string {
  return value.replace(/key=[^&\s]+/gi, "key=REDACTED");
}

/**
 * Call the Places API Nearby Search endpoint.
 * Logs per-request cost to console (never logs the raw key).
 */
export async function nearbySearch(
  lat: number,
  lon: number,
  radiusM: number,
  placeTypes: readonly string[],
  apiKey: string,
  fetchFn: (url: string, init: RequestInit) => Promise<Response>,
): Promise<readonly GooglePlaceNearby[]> {
  console.log(
    `[google-places] nearbySearch lat=${lat} lon=${lon} radius=${radiusM}m — cost $${COST_NEARBY_USD.toFixed(4)}`,
  );

  const body = JSON.stringify({
    includedTypes: placeTypes,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lon },
        radius: radiusM,
      },
    },
  });

  const response = await fetchFn(NEARBY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName,places.regularOpeningHours",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Google Places nearbySearch failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as NearbySearchResponse;
  return data.places ?? [];
}

export { COST_NEARBY_USD, COST_DETAILS_USD };
