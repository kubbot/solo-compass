import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseWikivoyageHtml, toCandidates } from "./parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LISBON_HTML = readFileSync(join(__dirname, "__fixtures__/lisbon.html"), "utf8");
const ARTICLE_URL = "https://en.wikivoyage.org/wiki/Lisbon";

describe("parseWikivoyageHtml — Lisbon fixture", () => {
  it("extracts POIs from all four sections", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    expect(pois.length).toBe(9);
  });

  it("includes POIs from See section", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const titles = pois.map((p) => p.title);
    expect(titles).toContain("Jerónimos Monastery");
    expect(titles).toContain("Belém Tower");
    expect(titles).toContain("São Jorge Castle");
  });

  it("includes POIs from Do section", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const titles = pois.map((p) => p.title);
    expect(titles).toContain("Tram 28 Ride");
    expect(titles).toContain("LX Factory");
  });

  it("includes POIs from Eat section", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const titles = pois.map((p) => p.title);
    expect(titles).toContain("Pastéis de Belém");
    expect(titles).toContain("Taberna da Rua das Flores");
  });

  it("includes POIs from Drink section", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const titles = pois.map((p) => p.title);
    expect(titles).toContain("Park Bar");
    expect(titles).toContain("Pensão Amor");
  });

  it("extracts coordinates from data-lat/data-lon attributes as [lon, lat]", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const monastery = pois.find((p) => p.title === "Jerónimos Monastery");
    expect(monastery?.coordinates).toBeDefined();
    // data-lat="38.6971" data-lon="-9.2069" → [lon, lat]
    expect(monastery?.coordinates?.[0]).toBeCloseTo(-9.2069, 3);
    expect(monastery?.coordinates?.[1]).toBeCloseTo(38.6971, 3);
  });

  it("extracts coordinates from .geo span as [lon, lat]", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const castle = pois.find((p) => p.title === "São Jorge Castle");
    expect(castle?.coordinates).toBeDefined();
    // .geo "38.7139; -9.1334" → [lon, lat]
    expect(castle?.coordinates?.[0]).toBeCloseTo(-9.1334, 3);
    expect(castle?.coordinates?.[1]).toBeCloseTo(38.7139, 3);
  });

  it("sets sectionUrl to article URL with section anchor", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const monastery = pois.find((p) => p.title === "Jerónimos Monastery");
    expect(monastery?.sectionUrl).toBe(`${ARTICLE_URL}#See`);
    const tram = pois.find((p) => p.title === "Tram 28 Ride");
    expect(tram?.sectionUrl).toBe(`${ARTICLE_URL}#Do`);
  });

  it("captures description text", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const bar = pois.find((p) => p.title === "Park Bar");
    expect(bar?.description).toContain("Rooftop bar");
    expect(bar?.description).toContain("Bairro Alto");
  });
});

describe("toCandidates", () => {
  it("returns Candidate[] with correct shape", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const candidates = toCandidates(pois, "lisbon", ARTICLE_URL);

    expect(candidates.length).toBe(pois.length);
    for (const c of candidates) {
      expect(c.sourceName).toBe("Wikivoyage");
      expect(c.sourceId).toMatch(/^wikivoyage:lisbon:/);
      expect(c.url).toBe(ARTICLE_URL);
      expect(c.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("embeds CC-BY-SA-3.0 attribution in rawText", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const candidates = toCandidates(pois, "lisbon", ARTICLE_URL);
    for (const c of candidates) {
      expect(c.rawText).toContain("CC-BY-SA-3.0");
    }
  });

  it("embeds section source_url in rawText", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const candidates = toCandidates(pois, "lisbon", ARTICLE_URL);
    const monastery = candidates.find((c) => c.title === "Jerónimos Monastery");
    expect(monastery?.rawText).toContain(`${ARTICLE_URL}#See`);
  });

  it("preserves coordinates as [lon, lat] tuple", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const candidates = toCandidates(pois, "lisbon", ARTICLE_URL);
    const monastery = candidates.find((c) => c.title === "Jerónimos Monastery");
    expect(monastery?.coordinates?.[0]).toBeCloseTo(-9.2069, 3);
    expect(monastery?.coordinates?.[1]).toBeCloseTo(38.6971, 3);
  });

  it("generates unique sourceIds", () => {
    const pois = parseWikivoyageHtml(LISBON_HTML, ARTICLE_URL);
    const candidates = toCandidates(pois, "lisbon", ARTICLE_URL);
    const ids = candidates.map((c) => c.sourceId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
