/**
 * E2E extraction tests for structureExperience.
 *
 * All tests use golden-replay mocks — no ANTHROPIC_API_KEY needed.
 * Run `pnpm test:live` to re-run against the real API.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { structureExperience } from "./prompts/structure-experience";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, "__fixtures__");
const GOLDEN_DIR = join(__dirname, "__golden__");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

interface GoldenReplay {
  tool: string;
  input: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
}

function loadGolden(name: string): GoldenReplay {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, name), "utf8")) as GoldenReplay;
}

function makeMockClient(golden: GoldenReplay): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "tool_use",
            name: golden.tool,
            input: golden.input,
          },
        ],
        usage: golden.usage,
        model: "claude-opus-4-7",
      }),
    },
  } as unknown as Anthropic;
}

// ─── Fixture 1: Wikivoyage — rich cultural experience ─────────────────────────

describe("structureExperience — Wikivoyage Doi Suthep", () => {
  const rawText = loadFixture("wikivoyage-chiang-mai-suthep.txt");
  const golden = loadGolden("wikivoyage-chiang-mai-suthep.json");
  const SOURCE_URL = "https://en.wikivoyage.org/wiki/Chiang_Mai/Doi_Suthep";

  const INPUT = {
    rawText,
    cityCode: "cmi",
    cityName: "Chiang Mai",
    sourceUrl: SOURCE_URL,
    sourceType: "wikivoyage" as const,
  };

  it("returns a non-null experience", async () => {
    const mockClient = makeMockClient(golden);
    const result = await structureExperience(INPUT, mockClient);
    expect(result.experience).not.toBeNull();
  });

  it("experience passes full schema validation", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience).not.toBeNull();
    if (!experience) return;

    // Required string fields
    expect(typeof experience.id).toBe("string");
    expect(experience.id).toMatch(/^exp_cmi_/);
    expect(typeof experience.title).toBe("string");
    expect(experience.title.length).toBeGreaterThan(0);
    expect(typeof experience.oneLiner).toBe("string");
    expect(typeof experience.whyItMatters).toBe("string");

    // Category enum
    const validCategories = ["culture", "nature", "food", "coffee", "work", "wellness", "nightlife", "hidden"];
    expect(validCategories).toContain(experience.category);

    // Location
    expect(Array.isArray(experience.location.coordinates)).toBe(true);
    expect(experience.location.coordinates).toHaveLength(2);
    expect(typeof experience.location.coordinates[0]).toBe("number");
    expect(typeof experience.location.coordinates[1]).toBe("number");
    expect(experience.location.cityCode).toBe("cmi");

    // Times
    expect(Array.isArray(experience.bestTimes)).toBe(true);
    for (const t of experience.bestTimes) {
      expect(t.startHour).toBeGreaterThanOrEqual(0);
      expect(t.startHour).toBeLessThanOrEqual(23);
      expect(t.endHour).toBeGreaterThanOrEqual(0);
      expect(t.endHour).toBeLessThanOrEqual(23);
    }

    // Duration
    expect(typeof experience.durationMinutes.min).toBe("number");
    expect(typeof experience.durationMinutes.max).toBe("number");
    expect(experience.durationMinutes.max).toBeGreaterThanOrEqual(experience.durationMinutes.min);

    // HowTo: 3–7 steps
    expect(experience.howTo.length).toBeGreaterThanOrEqual(3);
    expect(experience.howTo.length).toBeLessThanOrEqual(7);

    // realInconveniences: ≥1
    expect(experience.realInconveniences.length).toBeGreaterThanOrEqual(1);
    const validIncCategories = ["scam", "crowds", "logistics", "weather", "etiquette", "safety", "other"];
    for (const inc of experience.realInconveniences) {
      expect(validIncCategories).toContain(inc.category);
      expect(typeof inc.text).toBe("string");
      expect(inc.text.length).toBeGreaterThan(0);
    }

    // Sources
    expect(experience.sources.length).toBeGreaterThanOrEqual(1);

    // Status is "candidate" for AI pipeline
    expect(experience.status).toBe("candidate");

    // Confidence level = 1 (non-negotiable per system prompt)
    expect(experience.confidence.level).toBe(1);
  });

  it("title is action-oriented, not a bare place name", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience).not.toBeNull();
    if (!experience) return;

    // Title should contain a verb (action word) — not just a noun phrase
    // Simple heuristic: contains at least one space and isn't all title-case nouns
    expect(experience.title).not.toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(experience.title.split(" ").length).toBeGreaterThanOrEqual(4);
  });

  it("every source URL appears verbatim in the input text — no hallucination", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience).not.toBeNull();
    if (!experience) return;

    const inputContent = `${rawText}\n${SOURCE_URL}`;
    for (const source of experience.sources) {
      if (source.url) {
        expect(inputContent).toContain(source.url);
      }
    }
  });

  it("model confidence is between 0 and 1", async () => {
    const mockClient = makeMockClient(golden);
    const result = await structureExperience(INPUT, mockClient);
    expect(result.modelConfidence).toBeGreaterThanOrEqual(0);
    expect(result.modelConfidence).toBeLessThanOrEqual(1);
  });

  it("coordinates are in GeoJSON order [longitude, latitude]", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience).not.toBeNull();
    if (!experience) return;

    const [lng, lat] = experience.location.coordinates;
    // Chiang Mai is in Thailand: lat ~18-19°N, lng ~98-99°E
    expect(lng).toBeGreaterThan(90);
    expect(lng).toBeLessThan(110);
    expect(lat).toBeGreaterThan(15);
    expect(lat).toBeLessThan(25);
  });
});

// ─── Fixture 2: Reddit — coffee micro-lot experience ─────────────────────────

describe("structureExperience — Reddit coffee thread", () => {
  const rawText = loadFixture("reddit-coffee-thread.md");
  const golden = loadGolden("reddit-coffee-thread.json");
  const SOURCE_URL = "https://www.reddit.com/r/chiangmai/comments/coffee_thread_2024";

  const INPUT = {
    rawText,
    cityCode: "cmi",
    cityName: "Chiang Mai",
    sourceUrl: SOURCE_URL,
    sourceType: "reddit" as const,
  };

  it("returns a non-null experience", async () => {
    const mockClient = makeMockClient(golden);
    const result = await structureExperience(INPUT, mockClient);
    expect(result.experience).not.toBeNull();
  });

  it("category is 'coffee' for coffee-focused source", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience).not.toBeNull();
    expect(experience?.category).toBe("coffee");
  });

  it("every source URL appears verbatim in the input text — no hallucination", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience).not.toBeNull();
    if (!experience) return;

    const inputContent = `${rawText}\n${SOURCE_URL}`;
    for (const source of experience.sources) {
      if (source.url) {
        expect(inputContent).toContain(source.url);
      }
    }
  });

  it("realInconveniences includes at least one honest downside", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience).not.toBeNull();
    expect(experience?.realInconveniences.length).toBeGreaterThanOrEqual(1);
  });

  it("experience ID uses city code prefix", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience?.id).toMatch(/^exp_cmi_/);
  });

  it("source type is set to 'reddit'", async () => {
    const mockClient = makeMockClient(golden);
    const { experience } = await structureExperience(INPUT, mockClient);
    expect(experience).not.toBeNull();
    if (!experience) return;
    const hasRedditSource = experience.sources.some((s) => s.type === "reddit");
    expect(hasRedditSource).toBe(true);
  });
});

// ─── Fixture 3: Insufficient blurb — refusal behavior ────────────────────────

describe("structureExperience — insufficient blurb (refusal)", () => {
  const rawText = loadFixture("insufficient-blurb.txt");
  const golden = loadGolden("insufficient-blurb.json");

  const INPUT = {
    rawText,
    cityCode: "cmi",
    cityName: "Chiang Mai",
  };

  it("returns null experience for thin source", async () => {
    const mockClient = makeMockClient(golden);
    const result = await structureExperience(INPUT, mockClient);
    expect(result.experience).toBeNull();
  });

  it("provides a non-empty refusal reason", async () => {
    const mockClient = makeMockClient(golden);
    const result = await structureExperience(INPUT, mockClient);
    expect(result.refusalReason).toBeDefined();
    expect(typeof result.refusalReason).toBe("string");
    expect(result.refusalReason!.length).toBeGreaterThan(10);
  });

  it("model confidence is 0 on refusal", async () => {
    const mockClient = makeMockClient(golden);
    const result = await structureExperience(INPUT, mockClient);
    expect(result.modelConfidence).toBe(0);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("structureExperience — edge cases", () => {
  it("handles model returning no tool call — returns null with reason", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "I cannot help with that." }],
          usage: { input_tokens: 50, output_tokens: 10 },
          model: "claude-opus-4-7",
        }),
      },
    } as unknown as Anthropic;

    const result = await structureExperience(
      { rawText: "some text", cityCode: "cmi", cityName: "Chiang Mai" },
      mockClient,
    );

    expect(result.experience).toBeNull();
    expect(result.refusalReason).toBeDefined();
    expect(result.modelConfidence).toBe(0);
  });

  it("handles unknown tool name — returns null with reason", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "tool_use",
              name: "some_unknown_tool",
              input: { data: "whatever" },
            },
          ],
          usage: { input_tokens: 50, output_tokens: 20 },
          model: "claude-opus-4-7",
        }),
      },
    } as unknown as Anthropic;

    const result = await structureExperience(
      { rawText: "some text", cityCode: "cmi", cityName: "Chiang Mai" },
      mockClient,
    );

    expect(result.experience).toBeNull();
    expect(result.refusalReason).toContain("some_unknown_tool");
    expect(result.modelConfidence).toBe(0);
  });

  it("handles API rejection (thrown error) — propagates exception", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("Rate limit exceeded")),
      },
    } as unknown as Anthropic;

    await expect(
      structureExperience(
        { rawText: "some text", cityCode: "cmi", cityName: "Chiang Mai" },
        mockClient,
      ),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("ID slug is generated from title — no spaces or special chars", async () => {
    const golden = loadGolden("wikivoyage-chiang-mai-suthep.json");
    const mockClient = makeMockClient(golden);

    const result = await structureExperience(
      {
        rawText: loadFixture("wikivoyage-chiang-mai-suthep.txt"),
        cityCode: "cmi",
        cityName: "Chiang Mai",
        sourceUrl: "https://en.wikivoyage.org/wiki/Chiang_Mai/Doi_Suthep",
        sourceType: "wikivoyage",
      },
      mockClient,
    );

    expect(result.experience).not.toBeNull();
    if (!result.experience) return;

    // ID must match pattern: exp_<cityCode>_<alphanumeric+underscores>
    expect(result.experience.id).toMatch(/^exp_[a-z0-9]+_[a-z0-9_]+$/);
  });

  it("soloScore is initialized with zero values from AI pipeline", async () => {
    const golden = loadGolden("reddit-coffee-thread.json");
    const mockClient = makeMockClient(golden);

    const result = await structureExperience(
      {
        rawText: loadFixture("reddit-coffee-thread.md"),
        cityCode: "cmi",
        cityName: "Chiang Mai",
        sourceUrl: "https://www.reddit.com/r/chiangmai/comments/coffee_thread_2024",
        sourceType: "reddit",
      },
      mockClient,
    );

    expect(result.experience).not.toBeNull();
    if (!result.experience) return;

    expect(result.experience.soloScore.basedOnCount).toBe(0);
    expect(result.experience.soloScore.overall).toBe(0);
  });

  it("nearbyExperienceIds starts empty — populated by recommendation engine later", async () => {
    const golden = loadGolden("wikivoyage-chiang-mai-suthep.json");
    const mockClient = makeMockClient(golden);

    const result = await structureExperience(
      {
        rawText: loadFixture("wikivoyage-chiang-mai-suthep.txt"),
        cityCode: "cmi",
        cityName: "Chiang Mai",
        sourceUrl: "https://en.wikivoyage.org/wiki/Chiang_Mai/Doi_Suthep",
        sourceType: "wikivoyage",
      },
      mockClient,
    );

    expect(result.experience?.nearbyExperienceIds).toEqual([]);
  });
});
