import levenshtein from "fast-levenshtein";
import { distanceMeters } from "@solo-compass/core";
import type { Candidate } from "@solo-compass/sources-core";

export interface MergedCandidate {
  /** Representative title (from the highest-priority source by insertion order). */
  readonly title: string;
  /** Combined coordinates: taken from the first candidate that has coords. */
  readonly coordinates?: readonly [number, number];
  /** All raw candidates that were folded into this merged entry. */
  readonly evidence: readonly Candidate[];
  /** All source URLs from all contributing candidates, deduplicated. */
  readonly sourceUrls: readonly string[];
}

export interface DedupStats {
  readonly input: number;
  readonly output: number;
  readonly mergedCount: number;
}

export interface DedupResult {
  readonly merged: MergedCandidate[];
  readonly stats: DedupStats;
}

const NAME_SIMILARITY_THRESHOLD = 0.85;
const COORD_DISTANCE_THRESHOLD_METERS = 50;

/** Normalise a title for comparison: lowercase, collapse whitespace, strip punctuation. */
function normaliseName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Jaro-style similarity using Levenshtein edit distance.
 * Returns a value in [0, 1] where 1 = identical.
 */
function nameSimilarity(a: string, b: string): number {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein.get(na, nb);
  return 1 - dist / maxLen;
}

function coordsMatch(
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
): boolean {
  if (a === undefined || b === undefined) return false;
  return distanceMeters(a, b) <= COORD_DISTANCE_THRESHOLD_METERS;
}

/** True when one normalised name is a substring of the other (catches parenthetical aliases). */
function isSubstringAlias(a: string, b: string): boolean {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  return na.includes(nb) || nb.includes(na);
}

function isSamePlace(a: Candidate, b: Candidate): boolean {
  const nameMatch =
    nameSimilarity(a.title, b.title) >= NAME_SIMILARITY_THRESHOLD ||
    isSubstringAlias(a.title, b.title);
  return nameMatch && coordsMatch(a.coordinates, b.coordinates);
}

function mergeCandidates(group: Candidate[]): MergedCandidate {
  const first = group[0]!;
  const coordinates = group.find((c) => c.coordinates !== undefined)?.coordinates;
  const sourceUrls = Array.from(
    new Set(group.flatMap((c) => (c.url !== undefined ? [c.url] : []))),
  );
  return {
    title: first.title,
    coordinates,
    evidence: group,
    sourceUrls,
  };
}

/**
 * Merge candidates from different sources that reference the same physical location.
 *
 * Two candidates are considered the same place when:
 *   - name fuzzy similarity >= 0.85 (Levenshtein-based)
 *   - coordinates are within 50 m of each other
 *
 * Candidates without coordinates are never merged with each other (only with
 * named matches that do have coords), which avoids false positives for
 * popular generic names like "Coffee Shop".
 */
export function dedup(candidates: readonly Candidate[]): DedupResult {
  const groups: Candidate[][] = [];

  for (const candidate of candidates) {
    let placed = false;
    for (const group of groups) {
      const representative = group[0]!;
      if (isSamePlace(representative, candidate)) {
        group.push(candidate);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([candidate]);
    }
  }

  const merged = groups.map(mergeCandidates);
  const mergedCount = candidates.length - merged.length;

  return {
    merged,
    stats: {
      input: candidates.length,
      output: merged.length,
      mergedCount,
    },
  };
}
