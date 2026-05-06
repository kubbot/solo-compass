/**
 * Cost monitoring wrapper for Anthropic API calls.
 *
 * Logs a structured JSON line to stdout on every call so Vercel / Railway log
 * drains can aggregate spend without a dedicated metrics backend.
 */

import type Anthropic from "@anthropic-ai/sdk";

// ─── Pricing constants — claude-opus-4-7, per million tokens, in cents ────────
const PRICE_PER_M = {
  input: 1500,
  output: 7500,
  cache_read: 150,
  cache_write: 1875,
} as const;

const WARNING_THRESHOLD_CENTS = 500; // $5 per single call

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CostSnapshot {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Integer cents. */
  estimatedUsdCents: number;
  model: string;
  /** Caller label, e.g. "nearby" or "bot:voice". */
  route: string;
  durationMs: number;
}

// ─── trackCost ────────────────────────────────────────────────────────────────

export function trackCost(snapshot: CostSnapshot): void {
  const logEntry = {
    event: "ai_cost",
    route: snapshot.route,
    usd_cents: snapshot.estimatedUsdCents,
    model: snapshot.model,
    input_tokens: snapshot.inputTokens,
    output_tokens: snapshot.outputTokens,
    cache_read_tokens: snapshot.cacheReadTokens,
    cache_write_tokens: snapshot.cacheWriteTokens,
    duration_ms: snapshot.durationMs,
  };
  console.log(JSON.stringify(logEntry));

  if (snapshot.estimatedUsdCents > WARNING_THRESHOLD_CENTS) {
    console.warn(
      `[ai_cost WARNING] Single call exceeded $${(WARNING_THRESHOLD_CENTS / 100).toFixed(2)}: ` +
        `route=${snapshot.route} usd_cents=${snapshot.estimatedUsdCents}`,
    );
  }
}

// ─── Internal helper: read optional cache token fields ───────────────────────
// The SDK's Usage type (v0.32.x) doesn't declare cache token fields, but the
// API returns them when prompt caching is active. We access them safely via
// unknown to stay compatible with both old and new SDK versions.

function getCacheTokens(usage: Anthropic.Usage): { read: number; write: number } {
  const u = usage as unknown as Record<string, unknown>;
  const read = typeof u["cache_read_input_tokens"] === "number" ? u["cache_read_input_tokens"] : 0;
  const write =
    typeof u["cache_creation_input_tokens"] === "number" ? u["cache_creation_input_tokens"] : 0;
  return { read, write };
}

// ─── estimateCents ────────────────────────────────────────────────────────────

function estimateCents(usage: Anthropic.Usage): number {
  const inputCents = (usage.input_tokens / 1_000_000) * PRICE_PER_M.input;
  const outputCents = (usage.output_tokens / 1_000_000) * PRICE_PER_M.output;
  const { read, write } = getCacheTokens(usage);
  const cacheReadCents = (read / 1_000_000) * PRICE_PER_M.cache_read;
  const cacheWriteCents = (write / 1_000_000) * PRICE_PER_M.cache_write;

  return Math.round(inputCents + outputCents + cacheReadCents + cacheWriteCents);
}

// ─── withCostTracking ─────────────────────────────────────────────────────────

export async function withCostTracking<T>(
  route: string,
  fn: () => Promise<{ result: T; usage: Anthropic.Usage; model: string }>,
): Promise<T> {
  const startMs = Date.now();
  const { result, usage, model } = await fn();
  const durationMs = Date.now() - startMs;

  const { read: cacheReadTokens, write: cacheWriteTokens } = getCacheTokens(usage);

  const snapshot: CostSnapshot = {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens,
    cacheWriteTokens,
    estimatedUsdCents: estimateCents(usage),
    model,
    route,
    durationMs,
  };

  trackCost(snapshot);
  return result;
}
