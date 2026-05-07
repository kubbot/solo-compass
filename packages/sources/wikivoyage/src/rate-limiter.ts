/**
 * Token-bucket rate limiter: max N requests per 60-second window.
 * Callers await `acquire()` before each HTTP request.
 */
export class RateLimiter {
  private readonly maxPerMinute: number;
  private readonly windowMs = 60_000;
  private timestamps: number[] = [];

  constructor(maxPerMinute = 10) {
    this.maxPerMinute = maxPerMinute;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxPerMinute) {
      const oldest = this.timestamps[0];
      // oldest is guaranteed to exist because length >= maxPerMinute >= 1
      const waitMs = this.windowMs - (now - (oldest ?? 0));
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      return this.acquire();
    }

    this.timestamps.push(now);
  }
}
