/**
 * Confidence — how much should the user trust this experience right now?
 *
 * The product is built on a strict honesty principle: never present stale
 * or unverified information as if it were fresh. Every piece of data carries
 * its own confidence, and the UI must surface it (icon color, badge, sort order).
 *
 * Five signal layers, weakest to strongest:
 *   L0  AI scraped from the web — unverified
 *   L1  AI re-fetched recently — recency without independent verification
 *   L2  Passive GPS traffic — users have been physically near recently
 *   L3  Active user reports — ratings, voice notes, photos
 *   L4  Trusted reporter — a high-weight user has personally verified
 *
 * The `level` is the highest layer that has fresh data. The `freshness` is how
 * long it's been since *any* layer touched this experience.
 */

export type ConfidenceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface Confidence {
  /** 0 (no data) → 5 (high-weight user verified) */
  readonly level: ConfidenceLevel;

  /** ISO 8601 of last verification of *any* type. */
  readonly lastVerifiedAt: string;

  /** Human-readable reason for the current level — shown in detail card. */
  readonly reason: string;

  /** Counts that contribute to the level. Surfaced for transparency. */
  readonly signals: {
    readonly aiScrapeAgeDays: number;
    readonly passiveGpsHits30d: number;
    readonly activeReports30d: number;
    readonly trustedVerifications: number;
  };
}

/**
 * Health status — derived from confidence + freshness. Drives the colored dot
 * in the UI.
 *
 *   🟢 healthy    — fresh, multiply verified
 *   🟡 fading     — getting older, fewer recent signals
 *   🔴 questioned — possibly stale, treat with skepticism
 *   ⚫ may-be-gone — no signals long enough we can't vouch for it
 */
export type HealthStatus = "healthy" | "fading" | "questioned" | "may_be_gone";

/**
 * Decay a confidence level based on how long ago `lastVerifiedAt` was.
 *
 * Time bands (days since lastVerifiedAt):
 *   < 30   — no decay, return current level unchanged
 *   30–59  — downgrade one level  (5→4, 4→3, 3→2, 2→1, 1→0, 0→0)
 *   60–89  — downgrade two levels (5→3, 4→2, 3→1, 2→0, already 0 stays 0)
 *   ≥ 90   — force to 0
 *
 * @param current        The current ConfidenceLevel.
 * @param lastVerifiedAt ISO 8601 UTC timestamp of last verification.
 * @param nowIso         Optional ISO 8601 for the current time (for testing).
 *                       Defaults to `new Date().toISOString()`.
 */
export function decayConfidence(
  current: ConfidenceLevel,
  lastVerifiedAt: string,
  nowIso?: string,
): ConfidenceLevel {
  const now = new Date(nowIso ?? new Date().toISOString()).getTime();
  const verified = new Date(lastVerifiedAt).getTime();
  const ageDays = (now - verified) / (1000 * 60 * 60 * 24);

  if (ageDays < 30) return current;
  if (ageDays >= 90) return 0;

  const steps = ageDays < 60 ? 1 : 2;
  const decayed = current - steps;
  return (decayed < 0 ? 0 : decayed) as ConfidenceLevel;
}

export function healthFromConfidence(c: Confidence): HealthStatus {
  const ageDaysSinceLastVerify =
    (Date.now() - new Date(c.lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24);

  if (ageDaysSinceLastVerify > 60) return "may_be_gone";
  if (c.level >= 3 && ageDaysSinceLastVerify < 30) return "healthy";
  if (c.level >= 2 && ageDaysSinceLastVerify < 30) return "fading";
  return "questioned";
}
