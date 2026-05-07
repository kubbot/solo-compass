import { describe, it, expect, vi, beforeEach } from "vitest";
import { GooglePlacesAdapter } from "./adapter.js";
import type { NearbySearchResponse } from "./types.js";

const MOCK_KEY = "test-api-key-123";

function makeMockFetch(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => payload,
  } as Response);
}

const NEARBY_PAYLOAD: NearbySearchResponse = {
  places: [
    {
      name: "places/ChIJabc123",
      id: "ChIJabc123",
      displayName: { text: "Wat Suan Dok" },
      location: { latitude: 18.79, longitude: 98.97 },
      rating: 4.5,
      userRatingCount: 1200,
      priceLevel: "PRICE_LEVEL_FREE",
      primaryTypeDisplayName: { text: "Place of worship" },
      regularOpeningHours: {
        weekdayDescriptions: [
          "Monday: 6:00 AM – 6:00 PM",
          "Tuesday: 6:00 AM – 6:00 PM",
        ],
      },
    },
    {
      name: "places/ChIJxyz456",
      id: "ChIJxyz456",
      displayName: { text: "Ristr8to Coffee" },
      location: { latitude: 18.80, longitude: 98.98 },
      rating: 4.8,
      userRatingCount: 680,
      priceLevel: "PRICE_LEVEL_MODERATE",
      primaryTypeDisplayName: { text: "Cafe" },
    },
  ],
};

describe("GooglePlacesAdapter", () => {
  describe("constructor", () => {
    it("throws when no API key is provided", () => {
      const orig = process.env["GOOGLE_PLACES_API_KEY"];
      delete process.env["GOOGLE_PLACES_API_KEY"];
      expect(() => new GooglePlacesAdapter()).toThrow(
        "GOOGLE_PLACES_API_KEY is required",
      );
      if (orig !== undefined) process.env["GOOGLE_PLACES_API_KEY"] = orig;
    });

    it("accepts apiKey via options", () => {
      expect(
        () =>
          new GooglePlacesAdapter({
            apiKey: MOCK_KEY,
            fetchFn: makeMockFetch({}),
          }),
      ).not.toThrow();
    });
  });

  describe("fetchNearby", () => {
    it("returns Candidate[] from nearby search response", async () => {
      const mockFetch = makeMockFetch(NEARBY_PAYLOAD);
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });

      const candidates = await adapter.fetchNearby(18.79, 98.97, 1000);

      expect(candidates).toHaveLength(2);

      const first = candidates[0]!;
      expect(first.sourceId).toBe("google_places:ChIJabc123");
      expect(first.sourceName).toBe("Google Places");
      expect(first.title).toBe("Wat Suan Dok");
      expect(first.coordinates).toEqual([98.97, 18.79]); // [lon, lat]
      expect(first.rawText).toContain("4.5/5");
      expect(first.rawText).toContain("1200 reviews");
      expect(first.rawText).toContain("Hours:");
      expect(first.rawText).toContain("$"); // price level rendered
    });

    it("uses GeoJSON coordinate order [lon, lat]", async () => {
      const mockFetch = makeMockFetch(NEARBY_PAYLOAD);
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });

      const candidates = await adapter.fetchNearby(18.79, 98.97, 1000);
      const coords = candidates[0]!.coordinates!;
      // longitude first
      expect(coords[0]).toBeCloseTo(98.97, 2);
      expect(coords[1]).toBeCloseTo(18.79, 2);
    });

    it("returns cached result on second call without re-fetching", async () => {
      const mockFetch = makeMockFetch(NEARBY_PAYLOAD);
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });

      await adapter.fetchNearby(18.79, 98.97, 1000);
      await adapter.fetchNearby(18.79, 98.97, 1000);

      // fetch is called once for nearbySearch
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns [] and logs warning when daily budget is exceeded", async () => {
      const mockFetch = makeMockFetch(NEARBY_PAYLOAD);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        dailyCapUsd: 0, // zero cap — every call is refused
        fetchFn: mockFetch,
      });

      const result = await adapter.fetchNearby(18.79, 98.97, 1000);
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("daily budget cap reached"),
      );
      expect(mockFetch).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("does not include raw Google API fields in rawText", async () => {
      const mockFetch = makeMockFetch(NEARBY_PAYLOAD);
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });

      const candidates = await adapter.fetchNearby(18.79, 98.97, 1000);
      for (const c of candidates) {
        // Raw field names from Google API must not leak into stored text
        expect(c.rawText).not.toContain("userRatingCount");
        expect(c.rawText).not.toContain("PRICE_LEVEL_");
        expect(c.rawText).not.toContain("regularOpeningHours");
        expect(c.rawText).not.toContain("primaryTypeDisplayName");
      }
    });

    it("skips places with empty display names", async () => {
      const payload: NearbySearchResponse = {
        places: [
          { name: "places/abc", id: "abc", displayName: { text: "" } },
          {
            name: "places/def",
            id: "def",
            displayName: { text: "Good Cafe" },
            location: { latitude: 1, longitude: 2 },
          },
        ],
      };
      const mockFetch = makeMockFetch(payload);
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });

      const candidates = await adapter.fetchNearby(1, 2, 500);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.title).toBe("Good Cafe");
    });

    it("logs per-request cost to console", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const mockFetch = makeMockFetch(NEARBY_PAYLOAD);
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });

      await adapter.fetchNearby(18.79, 98.97, 1000);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("cost $0.0170"),
      );
      logSpy.mockRestore();
    });
  });

  describe("fetch (SourceAdapter contract)", () => {
    it("derives lat/lon and radius from bbox and returns candidates", async () => {
      const mockFetch = makeMockFetch(NEARBY_PAYLOAD);
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });

      const results = await adapter.fetch({
        bbox: {
          minLon: 98.96,
          minLat: 18.78,
          maxLon: 98.98,
          maxLat: 18.80,
        },
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it("returns [] when no bbox is provided", async () => {
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: makeMockFetch({}),
      });

      const results = await adapter.fetch({ cityCode: "cmi" });
      expect(results).toEqual([]);
    });
  });

  describe("healthCheck", () => {
    it("returns true when API responds 200", async () => {
      const mockFetch = makeMockFetch({ result: { place_id: "x" } });
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });
      expect(await adapter.healthCheck()).toBe(true);
    });

    it("returns false when API call throws", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
      const adapter = new GooglePlacesAdapter({
        apiKey: MOCK_KEY,
        fetchFn: mockFetch,
      });
      expect(await adapter.healthCheck()).toBe(false);
    });
  });
});

describe("BudgetTracker (via adapter)", () => {
  it("allows calls within daily cap", async () => {
    const mockFetch = makeMockFetch(NEARBY_PAYLOAD);
    const adapter = new GooglePlacesAdapter({
      apiKey: MOCK_KEY,
      dailyCapUsd: 1.0, // plenty of headroom for one call
      fetchFn: mockFetch,
    });

    const candidates = await adapter.fetchNearby(18.79, 98.97, 500);
    expect(candidates.length).toBeGreaterThan(0);
  });
});
