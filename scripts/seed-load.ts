/**
 * seed-load.ts
 *
 * Reads JSON seed files from SEED_DIR (default: ./seeds), validates each
 * experience record, and upserts into the Supabase `experiences` table using
 * the service-role key (bypasses RLS).
 *
 * Idempotent: upsert by `id`. `last_verified_at` (stored in the confidence
 * JSONB blob) is preserved on existing rows — the seed value is used only when
 * INSERTing a new row (Postgres EXCLUDED semantics via onConflict).
 *
 * Run:  pnpm tsx scripts/seed-load.ts
 */

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database, ExperienceRow } from "../packages/data/src/db";

// ─── Env ───────────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function getEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// ─── Validation ────────────────────────────────────────────────────────────────

interface ValidationError {
  field: string;
  message: string;
}

/**
 * Lightweight runtime validation against the core Experience shape.
 * We do NOT pull in Zod — just explicit checks on fields that must exist.
 */
function validateExperience(raw: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `[${index}]`;

  if (typeof raw !== "object" || raw === null) {
    errors.push({ field: prefix, message: "must be an object" });
    return errors;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj["id"] !== "string" || obj["id"].trim() === "") {
    errors.push({ field: `${prefix}.id`, message: "must be a non-empty string" });
  }

  if (typeof obj["title"] !== "string" || obj["title"].trim() === "") {
    errors.push({ field: `${prefix}.title`, message: "must be a non-empty string" });
  }

  // location.coordinates must be [number, number]
  const location = obj["location"];
  if (typeof location !== "object" || location === null) {
    errors.push({ field: `${prefix}.location`, message: "must be an object" });
  } else {
    const loc = location as Record<string, unknown>;
    const coords = loc["coordinates"];
    if (
      !Array.isArray(coords) ||
      coords.length !== 2 ||
      typeof coords[0] !== "number" ||
      typeof coords[1] !== "number"
    ) {
      errors.push({
        field: `${prefix}.location.coordinates`,
        message: "must be [longitude, latitude] — two numbers",
      });
    }
    if (typeof loc["cityCode"] !== "string" || (loc["cityCode"] as string).trim() === "") {
      errors.push({ field: `${prefix}.location.cityCode`, message: "must be a non-empty string" });
    }
  }

  if (typeof obj["category"] !== "string") {
    errors.push({ field: `${prefix}.category`, message: "must be a string" });
  }

  if (typeof obj["status"] !== "string") {
    errors.push({ field: `${prefix}.status`, message: "must be a string" });
  }

  return errors;
}

// ─── Domain → Row mapper ───────────────────────────────────────────────────────

/**
 * Maps a JSON seed object (which matches the TS Experience shape) to the
 * SQL row shape expected by the `experiences` table.
 */
function experienceToRow(
  obj: Record<string, unknown>,
  existingLastVerifiedAt: string | null,
): Database["public"]["Tables"]["experiences"]["Insert"] {
  const location = obj["location"] as Record<string, unknown>;
  const coords = location["coordinates"] as [number, number];
  const duration = obj["durationMinutes"] as Record<string, unknown>;
  const stats = (obj["stats"] ?? {}) as Record<string, unknown>;

  // Preserve `confidence.lastVerifiedAt` on existing rows.
  // If the row already exists and has lastVerifiedAt set, don't overwrite it.
  const confidence = (obj["confidence"] ?? {}) as Record<string, unknown>;
  const resolvedConfidence =
    existingLastVerifiedAt != null
      ? { ...confidence, lastVerifiedAt: existingLastVerifiedAt }
      : confidence;

  return {
    id: obj["id"] as string,
    title: obj["title"] as string,
    one_liner: (obj["oneLiner"] ?? "") as string,
    why_it_matters: (obj["whyItMatters"] ?? "") as string,
    category: obj["category"] as string,
    // PostGIS geography — Supabase accepts WKT or GeoJSON string for inserts
    location: { type: "Point", coordinates: coords } as unknown as ExperienceRow["location"],
    city_code: location["cityCode"] as string,
    address_hint: (location["addressHint"] as string | undefined) ?? null,
    place_name_local: (location["placeNameLocal"] as string | undefined) ?? null,
    place_name_romanized: (location["placeNameRomanized"] as string | undefined) ?? null,
    best_times: (obj["bestTimes"] ?? []) as unknown as ExperienceRow["best_times"],
    duration_min: (duration?.["min"] as number | undefined) ?? 0,
    duration_max: (duration?.["max"] as number | undefined) ?? 0,
    how_to: (obj["howTo"] ?? []) as unknown as ExperienceRow["how_to"],
    real_inconveniences: (obj["realInconveniences"] ??
      []) as unknown as ExperienceRow["real_inconveniences"],
    solo_score: (obj["soloScore"] ?? {}) as unknown as ExperienceRow["solo_score"],
    sources: (obj["sources"] ?? []) as unknown as ExperienceRow["sources"],
    confidence: resolvedConfidence as unknown as ExperienceRow["confidence"],
    nearby_experience_ids: (obj["nearbyExperienceIds"] as string[] | undefined) ?? [],
    completion_count: (stats["completionCount"] as number | undefined) ?? 0,
    average_rating: (stats["averageRating"] as number | undefined) ?? 0,
    last_completed_at: (stats["lastCompletedAt"] as string | undefined) ?? null,
    status: (obj["status"] as string | undefined) ?? "active",
    created_at: (obj["createdAt"] as string | undefined) ?? new Date().toISOString(),
    updated_at: (obj["updatedAt"] as string | undefined) ?? new Date().toISOString(),
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const seedDir = resolve(getEnv("SEED_DIR", "./seeds"));
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const client = createClient<Database>(supabaseUrl, serviceRoleKey);

  // 1. Enumerate seed files
  let files: string[];
  try {
    const entries = await readdir(seedDir);
    files = entries.filter((f) => f.endsWith(".json"));
  } catch (err) {
    throw new Error(`Cannot read SEED_DIR "${seedDir}": ${(err as Error).message}`);
  }

  console.log(`seed-load: found ${files.length} JSON file(s) in ${seedDir}`);

  let totalRead = 0;
  let totalUpserted = 0;
  let totalSkipped = 0;

  // 2. Process each file
  for (const file of files) {
    const filePath = join(seedDir, file);
    const raw = await readFile(filePath, "utf-8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`  [SKIP] ${file}: invalid JSON`);
      continue;
    }

    // Normalise to an array
    const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    totalRead += items.length;

    // 3. Validate
    const valid: Record<string, unknown>[] = [];
    for (let i = 0; i < items.length; i++) {
      const errors = validateExperience(items[i], i);
      if (errors.length > 0) {
        console.warn(
          `  [INVALID] ${file}[${i}]:`,
          errors.map((e) => `${e.field}: ${e.message}`).join("; "),
        );
        totalSkipped++;
      } else {
        valid.push(items[i] as Record<string, unknown>);
      }
    }

    if (valid.length === 0) continue;

    // 4. Fetch existing rows to preserve last_verified_at in confidence JSON
    const ids = valid.map((v) => v["id"] as string);
    const { data: existing, error: fetchError } = await client
      .from("experiences")
      .select("id, confidence")
      .in("id", ids);

    if (fetchError) {
      throw new Error(`Failed to fetch existing rows: ${fetchError.message}`);
    }

    // Build a map of id → existing confidence.lastVerifiedAt
    const existingMap = new Map<string, string | null>();
    for (const row of existing ?? []) {
      const conf = row.confidence as Record<string, unknown> | null;
      const lv = (conf?.["lastVerifiedAt"] as string | undefined) ?? null;
      existingMap.set(row.id, lv);
    }

    // 5. Build rows
    const rows = valid.map((obj) => {
      const id = obj["id"] as string;
      const existingLastVerifiedAt = existingMap.get(id) ?? null;
      return experienceToRow(obj, existingLastVerifiedAt);
    });

    // 6. Upsert
    const { error: upsertError, count } = await client
      .from("experiences")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: false })
      .select("id");

    if (upsertError) {
      throw new Error(`Upsert failed for ${file}: ${upsertError.message}`);
    }

    const affected = count ?? rows.length;
    totalUpserted += affected;
    console.log(`  [OK] ${file}: ${affected} row(s) upserted`);
  }

  console.log(
    `\nseed-load complete — files: ${files.length}, records read: ${totalRead}, upserted: ${totalUpserted}, skipped: ${totalSkipped}`,
  );
}

main().catch((err) => {
  console.error("seed-load error:", (err as Error).message);
  process.exit(1);
});
