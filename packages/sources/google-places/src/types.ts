/** Google Places place types fetched by default. */
export const DEFAULT_PLACE_TYPES = [
  "tourist_attraction",
  "museum",
  "restaurant",
  "cafe",
  "bar",
  "night_club",
  "park",
  "place_of_worship",
  "spa",
] as const;

export type PlaceType = (typeof DEFAULT_PLACE_TYPES)[number];

/** Cost per API call in USD. */
export const COST_NEARBY_USD = 0.017;
export const COST_DETAILS_USD = 0.017;

/** Default daily budget cap in USD. */
export const DEFAULT_DAILY_CAP_USD = 50;

/** Cache TTLs in seconds. */
export const CACHE_TTL_NEARBY_SECONDS = 6 * 60 * 60; // 6 h
export const CACHE_TTL_DETAILS_SECONDS = 24 * 60 * 60; // 24 h

/**
 * Derived signals stored from a Google Place — NOT raw Google fields.
 * We store only what we derive, never the raw API response, to comply with
 * Google Places ToS (section 3.2.3: no caching of raw place data beyond session).
 */
export interface PlaceSignals {
  readonly placeId: string;
  readonly name: string;
  /** [longitude, latitude] — GeoJSON order */
  readonly coordinates: readonly [number, number];
  /** Google's star rating 1.0–5.0, if present */
  readonly rating?: number;
  /** Total user ratings count */
  readonly ratingsTotal?: number;
  /** Opening hours as plain text periods (derived, not the raw JSON blob) */
  readonly openingHoursSummary?: string;
  /** Price level 0–4 */
  readonly priceLevel?: number;
  /** Primary place type (e.g. "museum") */
  readonly primaryType?: string;
  readonly fetchedAt: string;
}

/** Raw Nearby Search result element from Google Places API (v1 / new). */
export interface GooglePlaceNearby {
  readonly name: string; // resource name, e.g. "places/ChIJ..."
  readonly id: string; // place_id
  readonly displayName?: { readonly text: string; readonly languageCode?: string };
  readonly location?: { readonly latitude: number; readonly longitude: number };
  readonly rating?: number;
  readonly userRatingCount?: number;
  readonly priceLevel?: string; // "PRICE_LEVEL_INEXPENSIVE" etc.
  readonly primaryTypeDisplayName?: { readonly text: string };
  readonly regularOpeningHours?: {
    readonly weekdayDescriptions?: readonly string[];
  };
}

/** Nearby Search API response envelope. */
export interface NearbySearchResponse {
  readonly places?: readonly GooglePlaceNearby[];
}

/** Options accepted by GooglePlacesAdapter. */
export interface GooglePlacesAdapterOptions {
  /** API key. Defaults to process.env.GOOGLE_PLACES_API_KEY. */
  apiKey?: string;
  /** Daily spend cap in USD. Defaults to process.env.GOOGLE_PLACES_DAILY_CAP_USD or 50. */
  dailyCapUsd?: number;
  /** Place types to fetch in Nearby Search. Defaults to DEFAULT_PLACE_TYPES. */
  placeTypes?: readonly string[];
  /** Inject a custom fetch function for testing. */
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
}
