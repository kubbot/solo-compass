import type { Candidate, SourceQuery } from "./types";

/**
 * Uniform contract every data-source adapter must satisfy.
 *
 * `weight` controls how many candidates this source contributes relative
 * to others when the registry blends results (higher = more candidates
 * requested). Keep it between 0 and 1; the registry normalises them.
 */
export interface SourceAdapter {
  readonly name: string;
  readonly weight: number;
  fetch(query: SourceQuery): Promise<Candidate[]>;
  healthCheck(): Promise<boolean>;
}
