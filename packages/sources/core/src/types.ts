/**
 * Geospatial bounding box for source queries.
 * Coords are [longitude, latitude] (GeoJSON convention).
 */
export interface BBox {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
}

/**
 * Query passed to a SourceAdapter.fetch().
 * At least one of `bbox` or `cityCode` must narrow the search.
 */
export interface SourceQuery {
  readonly bbox?: BBox;
  readonly cityCode?: string;
  readonly keywords?: readonly string[];
  readonly maxResults?: number;
}

/**
 * A raw candidate returned by a source adapter before enrichment.
 * Shapes from different sources are normalised into this before
 * they reach the AI structuring step.
 */
export interface Candidate {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly title: string;
  readonly rawText: string;
  readonly url?: string;
  /** [longitude, latitude] */
  readonly coordinates?: readonly [number, number];
  readonly fetchedAt: string;
}
