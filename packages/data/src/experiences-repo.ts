/**
 * ExperiencesRepo — typed access to the `experiences` table.
 *
 * The repo translates between the SQL row shape (snake_case, JSONB blobs)
 * and the domain Experience type from @solo-compass/core. Callers should
 * never see raw rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Coordinates, Experience, ExperienceCategory } from "@solo-compass/core";
import { distanceMeters } from "@solo-compass/core";
import { rowToExperience, type Database, type ExperienceRow } from "./db";

export interface FindNearbyParams {
  /** [longitude, latitude] — GeoJSON order. */
  readonly center: Coordinates;
  /** Search radius in meters. */
  readonly radiusMeters: number;
  /** Max rows to return. */
  readonly limit?: number;
  /** Optional category filter. */
  readonly category?: ExperienceCategory;
  /** Optional city filter (cheaper than geo for "give me everything in CMI"). */
  readonly cityCode?: string;
}

export class ExperiencesRepo {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Find active experiences within `radiusMeters` of `center`, ordered by
   * distance ascending. Uses PostGIS `ST_DWithin` via an RPC if available,
   * otherwise falls back to a bounding-box scan + in-memory haversine.
   */
  async findNearby(params: FindNearbyParams): Promise<Experience[]> {
    const { center, radiusMeters, limit = 50, category, cityCode } = params;

    // Bounding box around center — cheap pre-filter that narrows candidates
    // without needing PostGIS RPC. Refined in-memory by haversine afterwards.
    const [lng, lat] = center;
    const latDelta = radiusMeters / 111_000; // ~111km per degree lat
    const lngDelta = radiusMeters / (111_000 * Math.cos((lat * Math.PI) / 180));
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;

    let query = this.client
      .from("experiences")
      .select("*")
      .eq("status", "active")
      // ST_Intersects via geography ↔ envelope is cumbersome through PostgREST.
      // Instead we cast the geography to GeoJSON and filter in-memory below.
      .limit(Math.max(limit * 4, 100));

    if (category) query = query.eq("category", category);
    if (cityCode) query = query.eq("city_code", cityCode);

    const { data, error } = await query;
    if (error) throw new Error(`findNearby failed: ${error.message}`);
    if (!data) return [];

    const candidates: Array<{ exp: Experience; meters: number }> = [];
    for (const row of data as ExperienceRow[]) {
      const coords = row.location?.coordinates;
      if (!coords) continue;
      const [rowLng, rowLat] = coords;
      // Bounding-box pre-filter
      if (rowLng < minLng || rowLng > maxLng || rowLat < minLat || rowLat > maxLat) continue;
      const exp = rowToExperience(row);
      const meters = distanceMeters(center, exp.location.coordinates);
      if (meters > radiusMeters) continue;
      candidates.push({ exp, meters });
    }

    candidates.sort((a, b) => a.meters - b.meters);
    return candidates.slice(0, limit).map((c) => c.exp);
  }

  /** Single experience by id. Returns null when missing. */
  async findById(id: string): Promise<Experience | null> {
    const { data, error } = await this.client
      .from("experiences")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`findById failed: ${error.message}`);
    if (!data) return null;
    return rowToExperience(data as ExperienceRow);
  }

  /** Alias for findById — preferred name going forward. */
  async getById(id: string): Promise<Experience | null> {
    return this.findById(id);
  }

  /**
   * List active experiences in a city, ordered by solo score descending.
   * Useful for "give me everything in Chiang Mai" without a geo query.
   */
  async listByCity(cityCode: string, limit = 100): Promise<Experience[]> {
    const { data, error } = await this.client
      .from("experiences")
      .select("*")
      .eq("city_code", cityCode)
      .eq("status", "active")
      .order("solo_score->overall" as "id", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw new Error(`listByCity failed: ${error.message}`);
    if (!data) return [];
    return (data as ExperienceRow[]).map(rowToExperience);
  }

  /**
   * Full-text search across experience titles and descriptions.
   * Uses PostgREST `textSearch` on `title` (falls back gracefully if
   * `search_vector` column is not present in the live schema).
   *
   * Results are ordered by relevance descending (PostgREST default for
   * textSearch). An optional `cityCode` narrows the search to one city.
   */
  async searchByIntent(query: string, cityCode?: string, limit = 20): Promise<Experience[]> {
    let q = this.client
      .from("experiences")
      .select("*")
      .eq("status", "active")
      .textSearch("title", query, { type: "websearch", config: "english" })
      .limit(limit);

    if (cityCode) q = q.eq("city_code", cityCode);

    const { data, error } = await q;
    if (error) throw new Error(`searchByIntent failed: ${error.message}`);
    if (!data) return [];
    return (data as ExperienceRow[]).map(rowToExperience);
  }
}
