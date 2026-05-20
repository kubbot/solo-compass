/**
 * LLMContext — the snapshot passed to every LLM call in Solo Compass.
 *
 * Assembled by ContextManager (iOS) and serialized as JSON into the
 * system-prompt block. Shared between TS (packages/core) and Swift
 * (Services/Context/ContextManager.swift).
 *
 * Mirror: apps/ios/SoloCompass/Services/Context/ContextManager.swift
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeatherSnapshot {
  /** Plain-English condition, e.g. "Partly cloudy". */
  readonly condition: string;
  /** Celsius. */
  readonly tempCelsius: number;
  /** 0–1. */
  readonly humidity: number;
}

export interface ViewportBBox {
  /** West longitude. */
  readonly minLon: number;
  /** South latitude. */
  readonly minLat: number;
  /** East longitude. */
  readonly maxLon: number;
  /** North latitude. */
  readonly maxLat: number;
}

export interface LLMContextPreferences {
  readonly soloTravelStyle: string;
  readonly preferredCategories: readonly string[];
  readonly maxDistanceKm: number;
}

export interface LLMContext {
  /** User's current location as [lon, lat]. Null when permission denied. */
  readonly location: readonly [number, number] | null;
  /** Map viewport bounding box. */
  readonly viewportBBox: ViewportBBox;
  /** Top-20 experience IDs currently visible in the viewport (by solo score). */
  readonly viewportPois: readonly string[];
  /** Serialized UserPreferences relevant to LLM. */
  readonly preferences: LLMContextPreferences;
  /** ISO 8601 local time at the experience's location. */
  readonly localTime: string;
  /** Optional — absent when weather service is unavailable. */
  readonly weather?: WeatherSnapshot;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationResult = { ok: true; value: LLMContext } | { ok: false; errors: string[] };

/** Runtime validation for LLMContext. Use at system boundaries. */
export function validateLLMContext(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["root must be an object"] };
  }

  const obj = raw as Record<string, unknown>;

  // location
  if (obj["location"] !== null) {
    if (
      !Array.isArray(obj["location"]) ||
      obj["location"].length !== 2 ||
      typeof obj["location"][0] !== "number" ||
      typeof obj["location"][1] !== "number"
    ) {
      errors.push("location must be [number, number] or null");
    }
  }

  // viewportBBox
  const bbox = obj["viewportBBox"];
  if (bbox === null || typeof bbox !== "object" || Array.isArray(bbox)) {
    errors.push("viewportBBox must be an object");
  } else {
    const b = bbox as Record<string, unknown>;
    for (const key of ["minLon", "minLat", "maxLon", "maxLat"] as const) {
      if (typeof b[key] !== "number") errors.push(`viewportBBox.${key} must be a number`);
    }
  }

  // viewportPois
  if (!Array.isArray(obj["viewportPois"])) {
    errors.push("viewportPois must be an array");
  } else {
    if (obj["viewportPois"].length > 20) errors.push("viewportPois must have at most 20 items");
    if (!obj["viewportPois"].every((x) => typeof x === "string")) {
      errors.push("viewportPois items must be strings");
    }
  }

  // preferences
  const prefs = obj["preferences"];
  if (prefs === null || typeof prefs !== "object" || Array.isArray(prefs)) {
    errors.push("preferences must be an object");
  } else {
    const p = prefs as Record<string, unknown>;
    if (typeof p["soloTravelStyle"] !== "string")
      errors.push("preferences.soloTravelStyle must be a string");
    if (!Array.isArray(p["preferredCategories"]))
      errors.push("preferences.preferredCategories must be an array");
    if (typeof p["maxDistanceKm"] !== "number")
      errors.push("preferences.maxDistanceKm must be a number");
  }

  // localTime
  if (typeof obj["localTime"] !== "string" || !obj["localTime"]) {
    errors.push("localTime must be a non-empty string");
  }

  // weather (optional)
  if (obj["weather"] !== undefined) {
    const w = obj["weather"];
    if (w === null || typeof w !== "object" || Array.isArray(w)) {
      errors.push("weather must be an object when present");
    } else {
      const weather = w as Record<string, unknown>;
      if (typeof weather["condition"] !== "string")
        errors.push("weather.condition must be a string");
      if (typeof weather["tempCelsius"] !== "number")
        errors.push("weather.tempCelsius must be a number");
      if (typeof weather["humidity"] !== "number") errors.push("weather.humidity must be a number");
      else if ((weather["humidity"] as number) < 0 || (weather["humidity"] as number) > 1) {
        errors.push("weather.humidity must be between 0 and 1");
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: obj as unknown as LLMContext };
}

/** Throws if validation fails. */
export function parseLLMContext(raw: unknown): LLMContext {
  const result = validateLLMContext(raw);
  if (!result.ok) {
    throw new Error(`Invalid LLMContext: ${result.errors.join("; ")}`);
  }
  return result.value;
}
