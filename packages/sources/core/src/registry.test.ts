import { describe, it, expect } from "vitest";
import { getActiveAdapters } from "./registry";
import type { SourceAdapter } from "./adapter";
import type { Candidate } from "./types";

function makeAdapter(name: string, weight: number): SourceAdapter {
  return {
    name,
    weight,
    fetch: async (): Promise<Candidate[]> => [],
    healthCheck: async (): Promise<boolean> => true,
  };
}

describe("getActiveAdapters", () => {
  it("returns all adapters when enabled is not specified", () => {
    const adapters = [makeAdapter("wikivoyage", 0.8), makeAdapter("reddit", 0.5)];
    const result = getActiveAdapters({ adapters });
    expect(result.map((a) => a.name)).toEqual(["wikivoyage", "reddit"]);
  });

  it("filters to enabled names when specified", () => {
    const adapters = [
      makeAdapter("wikivoyage", 0.8),
      makeAdapter("reddit", 0.5),
      makeAdapter("blog", 0.3),
    ];
    const result = getActiveAdapters({ adapters, enabled: ["wikivoyage", "blog"] });
    expect(result.map((a) => a.name)).toEqual(["wikivoyage", "blog"]);
  });

  it("excludes adapters with zero weight", () => {
    const adapters = [makeAdapter("wikivoyage", 0.8), makeAdapter("disabled", 0)];
    const result = getActiveAdapters({ adapters });
    expect(result.map((a) => a.name)).toEqual(["wikivoyage"]);
  });

  it("returns empty array when enabled list matches nothing", () => {
    const adapters = [makeAdapter("wikivoyage", 0.8)];
    const result = getActiveAdapters({ adapters, enabled: ["nonexistent"] });
    expect(result).toHaveLength(0);
  });

  it("excludes zero-weight adapters even when listed in enabled", () => {
    const adapters = [makeAdapter("wikivoyage", 0), makeAdapter("reddit", 0.5)];
    const result = getActiveAdapters({ adapters, enabled: ["wikivoyage", "reddit"] });
    expect(result.map((a) => a.name)).toEqual(["reddit"]);
  });

  it("returns empty array when no adapters are registered", () => {
    const result = getActiveAdapters({ adapters: [] });
    expect(result).toHaveLength(0);
  });
});
