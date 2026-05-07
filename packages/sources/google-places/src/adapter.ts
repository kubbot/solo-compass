import NodeCache from "node-cache";
import type { SourceAdapter, SourceQuery, Candidate } from "@solo-compass/sources-core";
import { nearbySearch } from "./api.js";
import { BudgetTracker } from "./budget.js";
import {
  DEFAULT_PLACE_TYPES,
  CACHE_TTL_NEARBY_SECONDS,
  COST_NEARBY_USD,
  type GooglePlaceNearby,
  type GooglePlacesAdapterOptions,
  type PlaceSignals,
} from "./types.js";

const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

export class GooglePlacesAdapter implements SourceAdapter {
  readonly name = "google_places";
  readonly weight = 0.9;

  private readonly apiKey: string;
  private readonly placeTypes: readonly string[];
  private readonly budget: BudgetTracker;
  private readonly nearbyCache: NodeCache;
  private readonly fetchFn: (url: string, init: RequestInit) => Promise<Response>;

  constructor(options: GooglePlacesAdapterOptions = {}) {
    const key = options.apiKey ?? process.env["GOOGLE_PLACES_API_KEY"] ?? "";
    if (!key) {
      throw new Error("GooglePlacesAdapter: GOOGLE_PLACES_API_KEY is required");
    }
    this.apiKey = key;

    const capEnv = process.env["GOOGLE_PLACES_DAILY_CAP_USD"];
    const capUsd = options.dailyCapUsd ?? (capEnv !== undefined ? parseFloat(capEnv) : 50);

    this.placeTypes = options.placeTypes ?? DEFAULT_PLACE_TYPES;
    this.budget = new BudgetTracker(capUsd);
    this.nearbyCache = new NodeCache({
      stdTTL: CACHE_TTL_NEARBY_SECONDS,
      useClones: false,
    });
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Fetch nearby place candidates.
   * Results cached 6 h. Budget checked before every API call.
   */
  async fetchNearby(lat: number, lon: number, radiusM: number): Promise<Candidate[]> {
    const cacheKey = `nearby:${lat.toFixed(4)}:${lon.toFixed(4)}:${radiusM}`;
    const cached = this.nearbyCache.get<Candidate[]>(cacheKey);
    if (cached !== undefined) return cached;

    if (!this.budget.canAfford(COST_NEARBY_USD)) {
      console.warn(
        `[google-places] daily budget cap reached ($${this.budget.spent.toFixed(4)} spent) — skipping nearbySearch`,
      );
      return [];
    }
    this.budget.record(COST_NEARBY_USD);

    const places = await nearbySearch(
      lat,
      lon,
      radiusM,
      this.placeTypes,
      this.apiKey,
      this.fetchFn,
    );

    const candidates = placesToCandidates(places);
    this.nearbyCache.set(cacheKey, candidates);
    return candidates;
  }

  /** SourceAdapter contract. Derives lat/lon from bbox center or returns []. */
  async fetch(query: SourceQuery): Promise<Candidate[]> {
    if (query.bbox) {
      const lat = (query.bbox.minLat + query.bbox.maxLat) / 2;
      const lon = (query.bbox.minLon + query.bbox.maxLon) / 2;
      // Approximate radius from bbox diagonal / 2
      const latDelta = query.bbox.maxLat - query.bbox.minLat;
      const lonDelta = query.bbox.maxLon - query.bbox.minLon;
      const radiusM = Math.round(
        (Math.sqrt(latDelta * latDelta + lonDelta * lonDelta) / 2) * 111_000,
      );
      return this.fetchNearby(lat, lon, Math.min(radiusM, 50_000));
    }
    return [];
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Validate key with a zero-cost field mask check against a known place
      const url = `${PLACES_API_BASE}/details/json?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4&fields=place_id&key=${this.apiKey}`;
      const response = await this.fetchFn(url, {});
      return response.ok;
    } catch {
      return false;
    }
  }
}

/** Price level string → integer 0–4 */
function parsePriceLevel(raw: string | undefined): number | undefined {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return raw !== undefined ? map[raw] : undefined;
}

/** Derive storable signals from a Google Place — never retain raw fields. */
function extractSignals(place: GooglePlaceNearby): PlaceSignals {
  const loc = place.location;
  const coords: readonly [number, number] =
    loc !== undefined ? ([loc.longitude, loc.latitude] as const) : ([0, 0] as const);

  const weekdays = place.regularOpeningHours?.weekdayDescriptions;
  const openingHoursSummary =
    weekdays !== undefined && weekdays.length > 0 ? weekdays.join("; ") : undefined;

  return {
    placeId: place.id,
    name: place.displayName?.text ?? "",
    coordinates: coords,
    rating: place.rating,
    ratingsTotal: place.userRatingCount,
    openingHoursSummary,
    priceLevel: parsePriceLevel(place.priceLevel),
    primaryType: place.primaryTypeDisplayName?.text,
    fetchedAt: new Date().toISOString(),
  };
}

/** Build rawText from derived signals — no raw Google fields included. */
function signalsToRawText(signals: PlaceSignals): string {
  const parts: string[] = [];

  if (signals.primaryType) parts.push(`Type: ${signals.primaryType}`);
  if (signals.rating !== undefined) {
    const ratingLine =
      signals.ratingsTotal !== undefined
        ? `Rating: ${signals.rating}/5 (${signals.ratingsTotal} reviews)`
        : `Rating: ${signals.rating}/5`;
    parts.push(ratingLine);
  }
  if (signals.priceLevel !== undefined) {
    parts.push(`Price level: ${"$".repeat(signals.priceLevel + 1)}`);
  }
  if (signals.openingHoursSummary) {
    parts.push(`Hours: ${signals.openingHoursSummary}`);
  }

  return parts.join("\n");
}

function placesToCandidates(places: readonly GooglePlaceNearby[]): Candidate[] {
  return places
    .map((place): Candidate | null => {
      const signals = extractSignals(place);
      if (!signals.name) return null;

      return {
        sourceId: `google_places:${signals.placeId}`,
        sourceName: "Google Places",
        title: signals.name,
        rawText: signalsToRawText(signals),
        coordinates: signals.coordinates,
        fetchedAt: signals.fetchedAt,
      };
    })
    .filter((c): c is Candidate => c !== null);
}
