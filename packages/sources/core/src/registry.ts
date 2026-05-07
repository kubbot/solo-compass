import type { SourceAdapter } from "./adapter";

export interface SourcesConfig {
  /** Names of adapters that are enabled. If undefined, all registered adapters are active. */
  readonly enabled?: readonly string[];
  /** Adapters registered in the system. */
  readonly adapters: readonly SourceAdapter[];
}

/**
 * Returns the subset of adapters that should be used for a given config.
 * Filters to `enabled` names when provided; otherwise returns all adapters.
 * Zero-weight adapters are excluded.
 */
export function getActiveAdapters(config: SourcesConfig): SourceAdapter[] {
  const { adapters, enabled } = config;
  return adapters.filter((adapter) => {
    if (adapter.weight <= 0) return false;
    if (enabled !== undefined) return enabled.includes(adapter.name);
    return true;
  });
}
