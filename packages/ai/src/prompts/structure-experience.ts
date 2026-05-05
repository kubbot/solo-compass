import Anthropic from "@anthropic-ai/sdk";
import type {
  Experience,
  ExperienceId,
  ExperienceCategory,
  TimeWindow,
  HowToStep,
  RealInconvenience,
  InformationSource,
} from "@solo-compass/core";

// ─── Input / Output ────────────────────────────────────────────────────────────

export interface StructureExperienceInput {
  /** Raw text from Wikivoyage section, Reddit thread, blog post, etc. */
  rawText: string;
  /** ISO-style city code used in experience IDs, e.g. "cmi" for Chiang Mai. */
  cityCode: string;
  /** Human-readable city name for prompt context, e.g. "Chiang Mai". */
  cityName: string;
  /** Original URL of the source document — cited in output sources field. */
  sourceUrl?: string;
  /** Source type — defaults to "blog" when not specified. */
  sourceType?: InformationSource["type"];
}

export interface StructureExperienceResult {
  experience: Experience | null;
  /** Why the model returned null — only set when experience is null. */
  refusalReason?: string;
  /** Raw confidence 0–1 from the model on its own output quality. */
  modelConfidence: number;
}

// ─── Tool schemas for structured output ───────────────────────────────────────
// Tool-use API forces structured JSON instead of free-text parsing.
// Model calls either `emit_experience` (success) or `refuse` (insufficient source).

const EMIT_EXPERIENCE_TOOL: Anthropic.Tool = {
  name: "emit_experience",
  description:
    "Emit a structured Experience when the source material is rich enough to produce an honest, specific, verifiable experience.",
  input_schema: {
    type: "object" as const,
    required: [
      "title",
      "oneLiner",
      "whyItMatters",
      "category",
      "coordinates",
      "addressHint",
      "bestTimes",
      "durationMin",
      "durationMax",
      "howTo",
      "realInconveniences",
      "sources",
      "modelConfidence",
    ],
    properties: {
      title: {
        type: "string",
        description:
          "Action-oriented, specific title. NOT a place name. Example: 'Watch the sunset paint the white stupas at 17:30'",
      },
      oneLiner: {
        type: "string",
        description: "One sentence answering 'why does this experience exist?'",
      },
      whyItMatters: {
        type: "string",
        description:
          "Three sentences max. Atmosphere, sensory details, the feel of being there. No bullet points.",
      },
      category: {
        type: "string",
        enum: ["culture", "nature", "food", "coffee", "work", "wellness", "nightlife", "hidden"],
      },
      coordinates: {
        type: "object",
        description: "WGS84 — GeoJSON order [longitude, latitude], NOT [lat, lng]",
        required: ["longitude", "latitude"],
        properties: {
          longitude: { type: "number" },
          latitude: { type: "number" },
        },
      },
      addressHint: {
        type: "string",
        description:
          "Human-readable location hint. Can be vague. Do NOT fabricate a street address.",
      },
      placeNameLocal: {
        type: "string",
        description: "Name in local script, e.g. 'วัดสวนดอก'. Omit if not in source.",
      },
      placeNameRomanized: {
        type: "string",
        description: "Romanized place name, e.g. 'Wat Suan Dok'. Omit if not in source.",
      },
      bestTimes: {
        type: "array",
        description: "Time windows when this is at its best. Empty array = anytime.",
        items: {
          type: "object",
          required: ["startHour", "endHour"],
          properties: {
            startHour: { type: "number", minimum: 0, maximum: 23 },
            endHour: { type: "number", minimum: 0, maximum: 23 },
            note: { type: "string" },
          },
        },
      },
      durationMin: { type: "number", description: "Minimum typical duration in minutes" },
      durationMax: { type: "number", description: "Maximum typical duration in minutes" },
      howTo: {
        type: "array",
        description: "3–7 concrete steps. Each step is something the user physically does.",
        items: {
          type: "object",
          required: ["order", "text"],
          properties: {
            order: { type: "number" },
            text: { type: "string" },
          },
        },
      },
      realInconveniences: {
        type: "array",
        description:
          "The unflattering side. REQUIRED — at least one. Never omit or gloss over downsides.",
        items: {
          type: "object",
          required: ["category", "text"],
          properties: {
            category: {
              type: "string",
              enum: ["scam", "crowds", "logistics", "weather", "etiquette", "safety", "other"],
            },
            text: { type: "string" },
          },
        },
      },
      sources: {
        type: "array",
        description:
          "Cite every source with its original URL. Do NOT include URLs not present in the input.",
        items: {
          type: "object",
          required: ["type", "verifiedAt"],
          properties: {
            type: {
              type: "string",
              enum: ["wikivoyage", "wikipedia", "reddit", "blog", "youtube", "user", "field_visit"],
            },
            url: { type: "string" },
            attribution: { type: "string" },
            verifiedAt: { type: "string", description: "ISO 8601 timestamp" },
          },
        },
      },
      modelConfidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "Your confidence (0–1) that this output is accurate given the source material. Be honest.",
      },
    },
  },
};

const REFUSE_TOOL: Anthropic.Tool = {
  name: "refuse",
  description:
    "Refuse to emit an experience when source material is too thin, too generic, or would require fabrication.",
  input_schema: {
    type: "object" as const,
    required: ["reason"],
    properties: {
      reason: {
        type: "string",
        description:
          "Why you are refusing. Be specific: what is missing or unverifiable in the source.",
      },
    },
  },
};

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(cityName: string): string {
  return `You are a solo-travel experience curator for ${cityName}. Your job is to extract ONE concrete, time-bound, story-rich experience from raw source text.

WHAT YOU ARE EXTRACTING:
An "experience" is a specific thing worth doing — anchored to a place but NOT reducible to it.
  ✅ "Watch the sunset paint the white stupas at 17:30" — experience
  ❌ "Wat Suan Dok temple" — place name (reject this framing)

STRICT RULES — violating any of these is a critical failure:

1. NEVER fabricate. If a price, hour, or coordinate is not derivable from the text and your geographic knowledge of the city, call refuse().
2. ALWAYS populate realInconveniences with at least one honest downside. If none appear in the source, note: "other: specific downsides not confirmed in source — verify before visiting."
3. NEVER cite a URL that was not provided in the input. Set url only if the exact URL was given.
4. Set confidence.level = 1 (AI scrape, no human verify). Non-negotiable for this pipeline.
5. If source material yields only a generic summary ("great temple, worth visiting") with no sensory detail, no how-to, and no specific inconvenience — call refuse().
6. howTo must be 3–7 concrete steps. "Go there and enjoy it" is not a step.
7. title must be action-oriented. It cannot be a place name.

REFUSAL CRITERIA — call refuse() when:
- Source is fewer than ~150 words of substantive content
- Source describes a general area or district, not a specific experience
- You would need to fabricate coordinates, prices, or hours not in the source
- The experience is not solo-friendly (mandatory group activity, couples-only venue)`;
}

// ─── Main function ─────────────────────────────────────────────────────────────

export async function structureExperience(
  input: StructureExperienceInput,
  client?: Anthropic,
): Promise<StructureExperienceResult> {
  const anthropic = client ?? new Anthropic();
  const now = new Date().toISOString();

  const userMessage = `Source type: ${input.sourceType ?? "blog"}
City: ${input.cityName} (code: ${input.cityCode})
${input.sourceUrl ? `Source URL: ${input.sourceUrl}` : "No source URL provided"}

---RAW SOURCE TEXT---
${input.rawText}
---END SOURCE TEXT---

Extract one concrete experience from the text above, or call refuse() if the material is too thin.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    system: buildSystemPrompt(input.cityName),
    tools: [EMIT_EXPERIENCE_TOOL, REFUSE_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return {
      experience: null,
      refusalReason: "Model did not call a tool — unexpected response format",
      modelConfidence: 0,
    };
  }

  if (toolUse.name === "refuse") {
    const args = toolUse.input as { reason: string };
    return { experience: null, refusalReason: args.reason, modelConfidence: 0 };
  }

  if (toolUse.name === "emit_experience") {
    const raw = toolUse.input as {
      title: string;
      oneLiner: string;
      whyItMatters: string;
      category: ExperienceCategory;
      coordinates: { longitude: number; latitude: number };
      addressHint: string;
      placeNameLocal?: string;
      placeNameRomanized?: string;
      bestTimes: Array<{ startHour: number; endHour: number; note?: string }>;
      durationMin: number;
      durationMax: number;
      howTo: Array<{ order: number; text: string }>;
      realInconveniences: Array<{ category: RealInconvenience["category"]; text: string }>;
      sources: Array<{
        type: InformationSource["type"];
        url?: string;
        attribution?: string;
        verifiedAt: string;
      }>;
      modelConfidence: number;
    };

    const slug = raw.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);

    const experience: Experience = {
      id: `exp_${input.cityCode}_${slug}` as ExperienceId,
      title: raw.title,
      oneLiner: raw.oneLiner,
      whyItMatters: raw.whyItMatters,
      category: raw.category,
      location: {
        coordinates: [raw.coordinates.longitude, raw.coordinates.latitude],
        cityCode: input.cityCode,
        addressHint: raw.addressHint,
        placeNameLocal: raw.placeNameLocal,
        placeNameRomanized: raw.placeNameRomanized,
      },
      bestTimes: raw.bestTimes.map(
        (t): TimeWindow => ({ startHour: t.startHour, endHour: t.endHour, note: t.note }),
      ),
      durationMinutes: { min: raw.durationMin, max: raw.durationMax },
      howTo: raw.howTo.map((s): HowToStep => ({ order: s.order, text: s.text })),
      realInconveniences: raw.realInconveniences,
      soloScore: {
        overall: 0,
        breakdown: {
          seatingFriendly: 0,
          soloPatronRatio: 0,
          staffPressure: 0,
          soloPortioning: 0,
          ambianceFit: 0,
          safety: 0,
        },
        basedOnCount: 0,
      },
      sources: raw.sources,
      confidence: {
        level: 1,
        lastVerifiedAt: now,
        reason: "AI-scraped from open sources, no human verification",
        signals: {
          aiScrapeAgeDays: 0,
          passiveGpsHits30d: 0,
          activeReports30d: 0,
          trustedVerifications: 0,
        },
      },
      nearbyExperienceIds: [],
      stats: { completionCount: 0, averageRating: 0 },
      status: "candidate",
      createdAt: now,
      updatedAt: now,
    };

    return { experience, modelConfidence: raw.modelConfidence };
  }

  return {
    experience: null,
    refusalReason: `Unknown tool called: ${toolUse.name}`,
    modelConfidence: 0,
  };
}
