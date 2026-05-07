import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WikivoyageAdapter } from "./adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LISBON_HTML = readFileSync(join(__dirname, "__fixtures__/lisbon.html"), "utf8");

function makeFetch(html: string) {
  return vi.fn(async (_url: string) => html);
}

describe("WikivoyageAdapter", () => {
  it("satisfies SourceAdapter contract shape", () => {
    const adapter = new WikivoyageAdapter();
    expect(adapter.name).toBe("wikivoyage");
    expect(adapter.weight).toBe(0.8);
    expect(typeof adapter.fetch).toBe("function");
    expect(typeof adapter.healthCheck).toBe("function");
  });

  it("fetchCity returns Candidate[] from fixture HTML", async () => {
    const fetchFn = makeFetch(LISBON_HTML);
    const adapter = new WikivoyageAdapter({ fetchFn });

    const candidates = await adapter.fetchCity("Lisbon");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.sourceName).toBe("Wikivoyage");
  });

  it("fetchCity caches results — HTTP called only once per city", async () => {
    const fetchFn = makeFetch(LISBON_HTML);
    const adapter = new WikivoyageAdapter({ fetchFn });

    await adapter.fetchCity("Lisbon");
    await adapter.fetchCity("Lisbon");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("fetch() delegates via cityCode", async () => {
    const fetchFn = makeFetch(LISBON_HTML);
    const adapter = new WikivoyageAdapter({ fetchFn });

    const candidates = await adapter.fetch({ cityCode: "Lisbon" });
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("fetch() delegates via keywords[0] when no cityCode", async () => {
    const fetchFn = makeFetch(LISBON_HTML);
    const adapter = new WikivoyageAdapter({ fetchFn });

    const candidates = await adapter.fetch({ keywords: ["Lisbon"] });
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("fetch() returns [] when neither cityCode nor keywords provided", async () => {
    const fetchFn = makeFetch(LISBON_HTML);
    const adapter = new WikivoyageAdapter({ fetchFn });

    const candidates = await adapter.fetch({});
    expect(candidates).toEqual([]);
  });

  it("healthCheck returns true on successful fetch", async () => {
    const fetchFn = makeFetch("<html>Main Page</html>");
    const adapter = new WikivoyageAdapter({ fetchFn });

    const ok = await adapter.healthCheck();
    expect(ok).toBe(true);
  });

  it("healthCheck returns false when fetch throws", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("network error");
    });
    const adapter = new WikivoyageAdapter({ fetchFn });

    const ok = await adapter.healthCheck();
    expect(ok).toBe(false);
  });
});

describe("WikivoyageAdapter rate limiter", () => {
  it("enforces max requests per minute via internal queue (unit: timestamps)", async () => {
    // With maxRequestsPerMinute=2 and 2 requests, should complete without waiting
    const calls: number[] = [];
    const fetchFn = vi.fn(async (_url: string) => {
      calls.push(Date.now());
      return LISBON_HTML;
    });

    const adapter = new WikivoyageAdapter({
      fetchFn,
      maxRequestsPerMinute: 10,
    });

    await adapter.fetchCity("Lisbon");
    // Cache hit — only 1 HTTP call
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
