/**
 * City — canonical city record with geonameId for deduplication.
 *
 * Multiple language variants of the same city (e.g. "万象", "Vientiane",
 * "ວຽງຈັນ") share the same geonameId. The seed loader dedupes by geonameId
 * so only one row per real city enters the database.
 */

export interface City {
  /** GeoNames unique identifier. Stable across language variants. */
  geonameId: number;
  /** Name in the local/native script of the country. */
  nameLocal: string;
  /** Name in the system/display language (romanized or English). */
  nameSystem: string;
  /** WGS-84 latitude. */
  lat: number;
  /** WGS-84 longitude. */
  lon: number;
  /** ISO 3166-1 alpha-2 country code, e.g. "TH", "LA", "VN". */
  countryCode: string;
}

/**
 * Deduplicate an array of City records by geonameId.
 * First occurrence wins (inner-first semantics, same as Overpass dedupe).
 */
export function dedupeByGeonameId(cities: City[]): City[] {
  const seen = new Set<number>();
  return cities.filter((c) => {
    if (seen.has(c.geonameId)) return false;
    seen.add(c.geonameId);
    return true;
  });
}
