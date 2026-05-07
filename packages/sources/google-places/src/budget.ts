/**
 * Daily budget tracker for Google Places API calls.
 *
 * Resets at UTC midnight. Refuses new calls once the daily cap is exceeded.
 * State is in-process only — a restart resets the counter. For production,
 * replace with a persistent store.
 */
export class BudgetTracker {
  private spentUsd = 0;
  private dayKey = utcDayKey();

  constructor(private readonly capUsd: number) {}

  /** Record a cost and return whether the call is allowed. */
  record(costUsd: number): boolean {
    this.rolloverIfNeeded();
    if (this.spentUsd + costUsd > this.capUsd) return false;
    this.spentUsd += costUsd;
    return true;
  }

  /** Check whether a cost would fit without recording it. */
  canAfford(costUsd: number): boolean {
    this.rolloverIfNeeded();
    return this.spentUsd + costUsd <= this.capUsd;
  }

  get spent(): number {
    this.rolloverIfNeeded();
    return this.spentUsd;
  }

  private rolloverIfNeeded(): void {
    const today = utcDayKey();
    if (today !== this.dayKey) {
      this.dayKey = today;
      this.spentUsd = 0;
    }
  }
}

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}
