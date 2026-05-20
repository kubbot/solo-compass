import { describe, it, expect } from "vitest";
import { validateLLMContext, parseLLMContext } from "./llm-context";

const validContext = {
  location: [100.5018, 13.7563] as [number, number],
  viewportBBox: { minLon: 100.4, minLat: 13.7, maxLon: 100.6, maxLat: 13.8 },
  viewportPois: ["exp_bkk_silom", "exp_bkk_terminal21"],
  preferences: {
    soloTravelStyle: "explorer",
    preferredCategories: ["coffee", "work"],
    maxDistanceKm: 5,
  },
  localTime: "2026-05-20T14:30:00+07:00",
};

describe("validateLLMContext", () => {
  it("accepts a fully valid context (no weather)", () => {
    const result = validateLLMContext(validContext);
    expect(result.ok).toBe(true);
  });

  it("accepts a valid context with weather", () => {
    const result = validateLLMContext({
      ...validContext,
      weather: { condition: "Sunny", tempCelsius: 32, humidity: 0.6 },
    });
    expect(result.ok).toBe(true);
  });

  it("accepts null location (permission denied)", () => {
    const result = validateLLMContext({ ...validContext, location: null });
    expect(result.ok).toBe(true);
  });

  it("accepts 20 viewportPois (max allowed)", () => {
    const pois = Array.from({ length: 20 }, (_, i) => `exp_bkk_${i}`);
    const result = validateLLMContext({ ...validContext, viewportPois: pois });
    expect(result.ok).toBe(true);
  });

  it("rejects 21 viewportPois", () => {
    const pois = Array.from({ length: 21 }, (_, i) => `exp_bkk_${i}`);
    const result = validateLLMContext({ ...validContext, viewportPois: pois });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("20"))).toBe(true);
  });

  it("rejects invalid location (3-element array)", () => {
    const result = validateLLMContext({ ...validContext, location: [1, 2, 3] });
    expect(result.ok).toBe(false);
  });

  it("rejects missing viewportBBox", () => {
    const { viewportBBox: _, ...rest } = validContext;
    const result = validateLLMContext(rest);
    expect(result.ok).toBe(false);
  });

  it("rejects weather with humidity out of 0-1 range", () => {
    const result = validateLLMContext({
      ...validContext,
      weather: { condition: "Rainy", tempCelsius: 25, humidity: 1.5 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("humidity"))).toBe(true);
  });

  it("rejects non-object root", () => {
    const result = validateLLMContext("not an object");
    expect(result.ok).toBe(false);
  });

  it("rejects missing preferences.maxDistanceKm", () => {
    const result = validateLLMContext({
      ...validContext,
      preferences: { soloTravelStyle: "explorer", preferredCategories: [] },
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseLLMContext", () => {
  it("returns typed value for valid input", () => {
    const ctx = parseLLMContext(validContext);
    expect(ctx.viewportPois).toHaveLength(2);
    expect(ctx.location).not.toBeNull();
  });

  it("throws for invalid input", () => {
    expect(() => parseLLMContext({ location: "bad" })).toThrow("Invalid LLMContext");
  });
});
