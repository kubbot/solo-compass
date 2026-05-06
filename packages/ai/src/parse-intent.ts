/**
 * parseIntent — regex+heuristic parser that extracts structured filters from a
 * natural-language intent string. No LLM call, no external dependencies.
 */

export interface IntentFilters {
  /** Duration range in minutes, e.g. [90, 150] for "2 hours". */
  durationMinMax?: [number, number];
  /** Detected vibe keywords, normalised to canonical labels. */
  vibes?: string[];
  /** Preferred hour 0–23 derived from time-of-day keyword. */
  timeOfDayHour?: number;
  /** Maximum budget in USD (integer). 0 = free. */
  budgetMax?: number;
  /** Whether the user prefers indoor, outdoor, or has no preference. */
  indoorOutdoor?: "indoor" | "outdoor" | "either";
  /** Always the original text, passed through verbatim. */
  rawText: string;
}

// ─── Duration ─────────────────────────────────────────────────────────────────

interface DurationRule {
  pattern: RegExp;
  resolve: (match: RegExpMatchArray) => [number, number];
}

const DURATION_RULES: DurationRule[] = [
  // "half day" / "half-day"
  {
    pattern: /half[\s-]day/i,
    resolve: () => [120, 240],
  },
  // "quick" / "quick thing" etc.
  {
    pattern: /\bquick\b/i,
    resolve: () => [0, 30],
  },
  // "N hour(s)" – with optional decimal, e.g. "1.5 hours"
  {
    pattern: /(\d+(?:\.\d+)?)\s*hours?/i,
    resolve: (m) => {
      const hrs = parseFloat(m[1] ?? "1");
      const mid = Math.round(hrs * 60);
      return [Math.round(mid * 0.75), Math.round(mid * 1.25)];
    },
  },
  // "N min(utes)" / "N-minute"
  {
    pattern: /(\d+)\s*(?:mins?|minutes?)/i,
    resolve: (m) => {
      const mins = parseInt(m[1] ?? "30", 10);
      return [Math.max(0, Math.round(mins * 0.67)), Math.round(mins * 1.33)];
    },
  },
];

function parseDuration(text: string): [number, number] | undefined {
  for (const rule of DURATION_RULES) {
    const match = text.match(rule.pattern);
    if (match) return rule.resolve(match);
  }
  return undefined;
}

// ─── Vibes ────────────────────────────────────────────────────────────────────

interface VibeRule {
  patterns: RegExp[];
  vibe: string;
}

const VIBE_RULES: VibeRule[] = [
  {
    patterns: [/\bquiet\b/i, /\bchill\b/i, /\bpeaceful\b/i, /\brelax\b/i, /\bserene\b/i],
    vibe: "quiet",
  },
  {
    patterns: [/\boutdoor/i, /\boutside\b/i, /\bfresh\s+air\b/i, /\bopen\s+air\b/i],
    vibe: "outdoor",
  },
  {
    patterns: [/\bindoor/i, /\binside\b/i, /\bair[\s-]?con\b/i, /\bair[\s-]?conditioned\b/i],
    vibe: "indoor",
  },
  {
    patterns: [/\bbusy\b/i, /\blively\b/i, /\benergy\b/i, /\bbuzzing\b/i, /\bvibrant\b/i],
    vibe: "lively",
  },
  {
    patterns: [/\bcheap\b/i, /\bbudget\b/i, /\bfree\b/i, /\bno[\s-]cost\b/i, /\baffordable\b/i],
    vibe: "budget",
  },
];

function parseVibes(text: string): string[] {
  const found: string[] = [];
  for (const rule of VIBE_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      found.push(rule.vibe);
    }
  }
  return found;
}

// ─── Time of day ──────────────────────────────────────────────────────────────

interface TimeRule {
  pattern: RegExp;
  hour: number;
}

const TIME_RULES: TimeRule[] = [
  { pattern: /\bmorning\b/i, hour: 8 },
  { pattern: /\bafternoon\b/i, hour: 14 },
  { pattern: /\bevening\b/i, hour: 18 },
  { pattern: /\bsunset\b/i, hour: 17 },
  { pattern: /\bnight\b/i, hour: 21 },
  // "now" intentionally omitted — would require Date(), which we avoid here
];

function parseTimeOfDay(text: string): number | undefined {
  for (const rule of TIME_RULES) {
    if (rule.pattern.test(text)) return rule.hour;
  }
  return undefined;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

function parseBudget(text: string): number | undefined {
  // "free" → 0
  if (/\bfree\b/i.test(text)) return 0;

  // "under NNN baht" / "NNN baht" — convert at 33 baht/USD
  const bahtMatch = text.match(/(?:under\s+)?(\d+(?:\.\d+)?)\s*baht/i);
  if (bahtMatch?.[1]) {
    return Math.round(parseFloat(bahtMatch[1]) / 33);
  }

  // "$NNN" or "under $NNN"
  const usdMatch = text.match(/\$(\d+(?:\.\d+)?)/);
  if (usdMatch?.[1]) {
    return Math.round(parseFloat(usdMatch[1]));
  }

  // "under NNN" / "less than NNN" when followed by no currency → assume USD
  const genericMatch = text.match(/(?:under|less\s+than)\s+(\d+(?:\.\d+)?)\b(?!\s*baht)/i);
  if (genericMatch?.[1]) {
    return Math.round(parseFloat(genericMatch[1]));
  }

  return undefined;
}

// ─── indoorOutdoor ────────────────────────────────────────────────────────────

function deriveIndoorOutdoor(
  vibes: string[],
): "indoor" | "outdoor" | "either" {
  const hasOutdoor = vibes.includes("outdoor");
  const hasIndoor = vibes.includes("indoor");
  if (hasOutdoor && !hasIndoor) return "outdoor";
  if (hasIndoor && !hasOutdoor) return "indoor";
  return "either";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseIntent(text: string): IntentFilters {
  const durationMinMax = parseDuration(text);
  const vibes = parseVibes(text);
  const timeOfDayHour = parseTimeOfDay(text);
  const budgetMax = parseBudget(text);
  const indoorOutdoor = deriveIndoorOutdoor(vibes);

  const filters: IntentFilters = { rawText: text };

  if (durationMinMax !== undefined) filters.durationMinMax = durationMinMax;
  if (vibes.length > 0) filters.vibes = vibes;
  if (timeOfDayHour !== undefined) filters.timeOfDayHour = timeOfDayHour;
  if (budgetMax !== undefined) filters.budgetMax = budgetMax;
  // Only set indoorOutdoor when we have a signal (skip "either" from no vibes)
  if (vibes.includes("outdoor") || vibes.includes("indoor")) {
    filters.indoorOutdoor = indoorOutdoor;
  }

  return filters;
}
