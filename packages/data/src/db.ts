import { createClient } from "@supabase/supabase-js";
import type { Experience, ExperienceId } from "@solo-compass/core";

// ─── Database row shapes ────────────────────────────────────────────────────────
// These mirror the SQL schema, not the TS domain types.
// The repository layer translates between the two.

// Row interfaces need `[key: string]: unknown` so they satisfy
// `Record<string, unknown>` as required by @supabase/postgrest-js GenericTable.Row.
// This is a Supabase v2 convention — the index signature doesn't widen the
// known typed fields, it just makes the structural check pass.

export interface ExperienceRow {
  [key: string]: unknown;
  id: string;
  title: string;
  one_liner: string;
  why_it_matters: string;
  category: string;
  // PostGIS geography returned as GeoJSON by Supabase
  location: { type: "Point"; coordinates: [number, number] };
  city_code: string;
  address_hint: string | null;
  place_name_local: string | null;
  place_name_romanized: string | null;
  best_times: unknown;
  duration_min: number;
  duration_max: number;
  how_to: unknown;
  real_inconveniences: unknown;
  solo_score: unknown;
  sources: unknown;
  confidence: unknown;
  nearby_experience_ids: string[];
  completion_count: number;
  average_rating: number;
  last_completed_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  [key: string]: unknown;
  id: string;
  handle: string;
  created_at: string;
}

export interface CompletionRow {
  [key: string]: unknown;
  id: string;
  user_id: string;
  experience_id: string;
  completed_at: string;
  rating: number | null;
  note: string | null;
}

export interface TrafficPingRow {
  [key: string]: unknown;
  experience_id: string;
  anon_id: string;
  pinged_at: string;
}

export interface Database {
  public: {
    Tables: {
      experiences: {
        Row: ExperienceRow;
        Insert: Omit<ExperienceRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ExperienceRow>;
        Relationships: never[];
      };
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<UserRow>;
        Relationships: never[];
      };
      completions: {
        Row: CompletionRow;
        Insert: Omit<CompletionRow, "id" | "completed_at"> & {
          id?: string;
          completed_at?: string;
        };
        Update: Partial<CompletionRow>;
        Relationships: never[];
      };
      traffic_pings: {
        Row: TrafficPingRow;
        Insert: Omit<TrafficPingRow, "pinged_at"> & { pinged_at?: string };
        Update: Partial<TrafficPingRow>;
        Relationships: never[];
      };
    };
    // Required by @supabase/postgrest-js GenericSchema — keep empty if unused.
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

// ─── Client factory ────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

/** Anon client — subject to RLS. Use in web/bot request handlers. */
export function createAnonClient() {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_KEY"));
}

/** Service-role client — bypasses RLS. Use only in server-side scripts. */
export function createServiceClient() {
  return createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

// ─── Row ↔ Domain mappers ──────────────────────────────────────────────────────

export function rowToExperience(row: ExperienceRow): Experience {
  return {
    id: row.id as ExperienceId,
    title: row.title,
    oneLiner: row.one_liner,
    whyItMatters: row.why_it_matters,
    category: row.category as Experience["category"],
    location: {
      coordinates: row.location.coordinates as [number, number],
      cityCode: row.city_code,
      addressHint: row.address_hint ?? undefined,
      placeNameLocal: row.place_name_local ?? undefined,
      placeNameRomanized: row.place_name_romanized ?? undefined,
    },
    bestTimes: row.best_times as Experience["bestTimes"],
    durationMinutes: { min: row.duration_min, max: row.duration_max },
    howTo: row.how_to as Experience["howTo"],
    realInconveniences: row.real_inconveniences as Experience["realInconveniences"],
    soloScore: row.solo_score as Experience["soloScore"],
    sources: row.sources as Experience["sources"],
    confidence: row.confidence as Experience["confidence"],
    nearbyExperienceIds: row.nearby_experience_ids as ExperienceId[],
    stats: {
      completionCount: row.completion_count,
      averageRating: Number(row.average_rating),
      lastCompletedAt: row.last_completed_at ?? undefined,
    },
    status: row.status as Experience["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
