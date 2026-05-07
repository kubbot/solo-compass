import { describe, it, expect } from "vitest";
import { dedup } from "../dedup";
import type { Candidate } from "@solo-compass/sources-core";

function makeCandidate(
  overrides: Partial<Candidate> & Pick<Candidate, "title" | "sourceId" | "sourceName">,
): Candidate {
  return {
    rawText: "Some raw text about the place.",
    fetchedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// Wat Phra Kaew, Bangkok — [lon, lat]
const BASE_COORDS: readonly [number, number] = [100.4913, 13.7516];

describe("dedup", () => {
  it("merges 3 candidates from different sources referencing the same place into 1", () => {
    const candidates: Candidate[] = [
      makeCandidate({
        sourceId: "wv_001",
        sourceName: "wikivoyage",
        title: "Wat Phra Kaew",
        coordinates: BASE_COORDS,
        url: "https://en.wikivoyage.org/wiki/Bangkok#Wat_Phra_Kaew",
      }),
      makeCandidate({
        sourceId: "osm_002",
        sourceName: "openstreetmap",
        title: "Wat Phra Kaew",
        // 10 m offset — still within 50 m
        coordinates: [100.4913, 13.7515],
        url: "https://www.openstreetmap.org/node/12345",
      }),
      makeCandidate({
        sourceId: "gp_003",
        sourceName: "google_places",
        title: "Wat Phra Kaew (Temple of the Emerald Buddha)",
        coordinates: [100.4914, 13.7516],
        url: "https://maps.google.com/?cid=99999",
      }),
    ];

    const result = dedup(candidates);

    expect(result.merged).toHaveLength(1);
    expect(result.stats.input).toBe(3);
    expect(result.stats.output).toBe(1);
    expect(result.stats.mergedCount).toBe(2);

    const merged = result.merged[0]!;
    expect(merged.evidence).toHaveLength(3);
    expect(merged.sourceUrls).toHaveLength(3);
    expect(merged.sourceUrls).toContain(
      "https://en.wikivoyage.org/wiki/Bangkok#Wat_Phra_Kaew",
    );
    expect(merged.sourceUrls).toContain(
      "https://www.openstreetmap.org/node/12345",
    );
    expect(merged.sourceUrls).toContain("https://maps.google.com/?cid=99999");
  });

  it("does not merge candidates that are nearby but have very different names", () => {
    const candidates: Candidate[] = [
      makeCandidate({
        sourceId: "a_001",
        sourceName: "source_a",
        title: "Temple of the Emerald Buddha",
        coordinates: BASE_COORDS,
      }),
      makeCandidate({
        sourceId: "b_001",
        sourceName: "source_b",
        title: "Grand Palace Bangkok",
        coordinates: [100.4914, 13.7516],
      }),
    ];

    const result = dedup(candidates);
    expect(result.merged).toHaveLength(2);
    expect(result.stats.mergedCount).toBe(0);
  });

  it("does not merge candidates with similar names that are far apart (> 50 m)", () => {
    const candidates: Candidate[] = [
      makeCandidate({
        sourceId: "a_001",
        sourceName: "source_a",
        title: "Coffee Shop",
        // ~1 km north
        coordinates: [100.4913, 13.7606],
      }),
      makeCandidate({
        sourceId: "b_001",
        sourceName: "source_b",
        title: "Coffee Shop",
        coordinates: BASE_COORDS,
      }),
    ];

    const result = dedup(candidates);
    expect(result.merged).toHaveLength(2);
    expect(result.stats.mergedCount).toBe(0);
  });

  it("does not merge candidates without coordinates even if names match", () => {
    const candidates: Candidate[] = [
      makeCandidate({
        sourceId: "a_001",
        sourceName: "source_a",
        title: "Sunrise Café",
        // no coordinates
      }),
      makeCandidate({
        sourceId: "b_001",
        sourceName: "source_b",
        title: "Sunrise Café",
        // no coordinates
      }),
    ];

    const result = dedup(candidates);
    expect(result.merged).toHaveLength(2);
  });

  it("preserves a single candidate unchanged", () => {
    const candidates: Candidate[] = [
      makeCandidate({
        sourceId: "a_001",
        sourceName: "source_a",
        title: "Unique Place",
        coordinates: BASE_COORDS,
        url: "https://example.com/unique",
      }),
    ];

    const result = dedup(candidates);
    expect(result.merged).toHaveLength(1);
    expect(result.stats).toEqual({ input: 1, output: 1, mergedCount: 0 });
    expect(result.merged[0]!.sourceUrls).toEqual(["https://example.com/unique"]);
  });

  it("returns empty result for empty input", () => {
    const result = dedup([]);
    expect(result.merged).toHaveLength(0);
    expect(result.stats).toEqual({ input: 0, output: 0, mergedCount: 0 });
  });

  it("deduplicates source URLs when the same URL appears in multiple candidates", () => {
    const sharedUrl = "https://example.com/place";
    const candidates: Candidate[] = [
      makeCandidate({
        sourceId: "a_001",
        sourceName: "source_a",
        title: "Same Place",
        coordinates: BASE_COORDS,
        url: sharedUrl,
      }),
      makeCandidate({
        sourceId: "b_001",
        sourceName: "source_b",
        title: "Same Place",
        coordinates: [100.4913, 13.7515],
        url: sharedUrl,
      }),
    ];

    const result = dedup(candidates);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0]!.sourceUrls).toHaveLength(1);
    expect(result.merged[0]!.sourceUrls[0]).toBe(sharedUrl);
  });
});
