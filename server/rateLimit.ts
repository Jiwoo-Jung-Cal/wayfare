// Fixed-window in-memory rate limiter (single server instance).
// Used to bound guest-session creation per client and AI extraction per
// workspace before the API is exposed publicly.

export type RateLimiter = {
  /** Count one hit for `key`. */
  take(key: string): { allowed: true } | { allowed: false; retryAfterSeconds: number };
};

export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();

  function prune(t: number) {
    if (windows.size < 10_000) return;
    for (const [k, w] of windows) if (t - w.start >= opts.windowMs) windows.delete(k);
  }

  return {
    take(key) {
      const t = now();
      prune(t);
      let w = windows.get(key);
      if (!w || t - w.start >= opts.windowMs) {
        w = { start: t, count: 0 };
        windows.set(key, w);
      }
      if (w.count >= opts.limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((w.start + opts.windowMs - t) / 1000)) };
      }
      w.count++;
      return { allowed: true };
    },
  };
}
