// Global, server-side rate limiter shared across EVERY open session.
//
// Gemini's free tier allows ~15 requests/minute (gemini-3.1-flash-lite free tier) on a single API key. Because all
// visitors share one key, the cap is global — so this limiter lives in the
// server process (module-level singleton), not in the browser. A sliding-window
// log guarantees we never exceed MAX_PER_WINDOW requests in any rolling 60s,
// which is the only shape that actually bounds a "per rolling minute" quota
// (a naive token bucket can burst to ~2x the rate in a single window).
//
// Caveat for production: module state is per server instance. In local dev
// (one process) this is exact. On serverless/Fluid Compute under heavy traffic
// the platform may run multiple instances, each with its own window — for a
// hard cross-instance guarantee, back this with Redis (e.g. @upstash/ratelimit).

const WINDOW_MS = 60_000;

// Cap below gemini-3.1-flash-lite's ~15 RPM free limit so transient counting
// differences never trip Google's hard 429. Tunable via env without a code change.
const MAX_PER_WINDOW = Number(process.env.GEMINI_MAX_RPM) || 12;

class SlidingWindowLimiter {
  private hits: number[] = [];

  /** Record and allow a request, or return false if the window is full. */
  tryAcquire(now: number = Date.now()): boolean {
    this.prune(now);
    if (this.hits.length < MAX_PER_WINDOW) {
      this.hits.push(now);
      return true;
    }
    return false;
  }

  /** Ms until a slot frees up — i.e. when the oldest hit ages out. */
  retryAfterMs(now: number = Date.now()): number {
    this.prune(now);
    if (this.hits.length < MAX_PER_WINDOW) return 0;
    return Math.max(0, this.hits[0] + WINDOW_MS - now);
  }

  private prune(now: number): void {
    const cutoff = now - WINDOW_MS;
    while (this.hits.length > 0 && this.hits[0] <= cutoff) {
      this.hits.shift();
    }
  }
}

// Singleton — persists across requests within a warm server instance.
export const visionRateLimiter = new SlidingWindowLimiter();
