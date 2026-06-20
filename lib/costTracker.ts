const STORAGE_KEY = "aria_session_cost";

/** Gemini 2.0 Flash free tier — $0 per token up to quota limits. */
const INPUT_PRICE_PER_TOKEN = 0;
const OUTPUT_PRICE_PER_TOKEN = 0;
const CACHED_INPUT_PRICE_PER_TOKEN = 0;
const CACHE_HIT_RATIO = 0;

export type TokenTotals = {
  input: number;
  output: number;
};

export class CostTracker {
  private input = 0;
  private output = 0;
  private hydrated = false;

  addUsage(input: number, output: number): void {
    this.hydrate();
    this.input += Number.isFinite(input) ? input : 0;
    this.output += Number.isFinite(output) ? output : 0;
    this.persist();
  }

  getTokens(): TokenTotals {
    this.hydrate();
    return { input: this.input, output: this.output };
  }

  getTotal(): string {
    this.hydrate();
    const cachedTokens = this.input * CACHE_HIT_RATIO;
    const freshTokens = this.input - cachedTokens;
    const total =
      freshTokens * INPUT_PRICE_PER_TOKEN +
      cachedTokens * CACHED_INPUT_PRICE_PER_TOKEN +
      this.output * OUTPUT_PRICE_PER_TOKEN;
    return `$${total.toFixed(4)}`;
  }

  reset(): void {
    this.input = 0;
    this.output = 0;
    this.hydrated = true;
    this.persist();
  }

  /** Lazy-load persisted totals; safe to call during SSR (no-op there). */
  private hydrate(): void {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TokenTotals>;
      this.input = typeof parsed.input === "number" ? parsed.input : 0;
      this.output = typeof parsed.output === "number" ? parsed.output : 0;
    } catch {
      // Corrupt storage — start the session at zero.
      this.input = 0;
      this.output = 0;
    }
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ input: this.input, output: this.output })
      );
    } catch {
      // Storage full or blocked — totals remain in memory for this session.
    }
  }
}

export const costTracker = new CostTracker();
