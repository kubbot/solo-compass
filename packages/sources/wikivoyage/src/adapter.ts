import NodeCache from "node-cache";
import type { SourceAdapter, SourceQuery, Candidate } from "@solo-compass/sources-core";
import { RateLimiter } from "./rate-limiter.js";
import { parseWikivoyageHtml, toCandidates } from "./parser.js";

const WIKIVOYAGE_BASE = "https://en.wikivoyage.org/wiki/";
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface WikivoyageAdapterOptions {
  /** Override the Wikivoyage base URL (useful for tests). */
  baseUrl?: string;
  /** Max requests per minute (default: 10). */
  maxRequestsPerMinute?: number;
  /** Inject a custom fetch function for testing. */
  fetchFn?: (url: string) => Promise<string>;
}

/**
 * Source adapter that fetches and parses Wikivoyage city articles.
 *
 * Public surface:
 *   fetchCity(cityName)  — high-level helper used by the pipeline
 *   fetch(query)         — SourceAdapter contract, delegates via cityCode or keywords
 */
export class WikivoyageAdapter implements SourceAdapter {
  readonly name = "wikivoyage";
  readonly weight = 0.8;

  private readonly baseUrl: string;
  private readonly limiter: RateLimiter;
  private readonly cache: NodeCache;
  private readonly fetchFn: (url: string) => Promise<string>;

  constructor(options: WikivoyageAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? WIKIVOYAGE_BASE;
    this.limiter = new RateLimiter(options.maxRequestsPerMinute ?? 10);
    this.cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, useClones: false });
    this.fetchFn = options.fetchFn ?? defaultFetch;
  }

  /**
   * Fetch POI candidates for a named city.
   * Results are cached for 7 days; rate-limited to ≤10 req/min.
   */
  async fetchCity(cityName: string): Promise<Candidate[]> {
    const slug = toWikivoyageSlug(cityName);
    const cached = this.cache.get<Candidate[]>(slug);
    if (cached !== undefined) return cached;

    const url = `${this.baseUrl}${encodeURIComponent(slug)}`;
    await this.limiter.acquire();
    const html = await this.fetchFn(url);

    const pois = parseWikivoyageHtml(html, url);
    const candidates = toCandidates(pois, slug, url);

    this.cache.set(slug, candidates);
    return candidates;
  }

  /** SourceAdapter contract. Uses `cityCode` as the city name when provided. */
  async fetch(query: SourceQuery): Promise<Candidate[]> {
    const cityName = query.cityCode ?? query.keywords?.[0];
    if (!cityName) return [];
    return this.fetchCity(cityName);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.limiter.acquire();
      const url = `${this.baseUrl}Main_Page`;
      const html = await this.fetchFn(url);
      return html.length > 0;
    } catch {
      return false;
    }
  }
}

function toWikivoyageSlug(cityName: string): string {
  // Wikivoyage article titles use title-case with spaces replaced by underscores
  return cityName
    .split(/\s+/)
    .map((w) => (w.length > 0 ? (w[0]?.toUpperCase() ?? "") + w.slice(1) : ""))
    .join("_");
}

async function defaultFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "SoloCompassBot/1.0 (data engine; contact: solo-compass@example.com)",
      Accept: "text/html",
    },
  });
  if (!response.ok) {
    throw new Error(`Wikivoyage fetch failed: ${response.status} ${response.statusText} — ${url}`);
  }
  return response.text();
}
