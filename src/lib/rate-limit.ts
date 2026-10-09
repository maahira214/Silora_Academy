/**
 * Simple in-memory rate limits (fixed window per key). Silora runs one app process on
 * one server, so memory is enough; counts reset when the app restarts, which is fine
 * for stopping floods and password-guessing-style abuse.
 * Kept on globalThis because route handlers can be bundled separately but share one process.
 */
type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __siloraRateLimits?: Map<string, Bucket> };
const buckets = (g.__siloraRateLimits ??= new Map());

export type Limit = { limit: number; windowMs: number };

/** The limits used across the app, in one place. */
export const LIMITS = {
  /** Google sign-in starts and callbacks, per IP address */
  signIn: { limit: 20, windowMs: 10 * 60_000 },
  /** Chat messages, per user */
  message: { limit: 30, windowMs: 60_000 },
  /** Chat file uploads, per user */
  upload: { limit: 20, windowMs: 10 * 60_000 },
  /** Chat polling (every 3 s per open chat), per user */
  poll: { limit: 300, windowMs: 60_000 },
} satisfies Record<string, Limit>;

export function rateLimit(key: string, { limit, windowMs }: Limit, now = Date.now()) {
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
    if (buckets.size > 10_000) prune(now);
  }
  b.count++;
  return { ok: b.count <= limit, retryAfterMs: b.count <= limit ? 0 : b.resetAt - now };
}

function prune(now: number) {
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
}

/** "in 4 minutes" style wording for error messages. */
export function retryText(ms: number) {
  const min = Math.ceil(ms / 60_000);
  return min <= 1 ? "in a minute" : `in ${min} minutes`;
}

/** For tests. */
export function resetRateLimits() {
  buckets.clear();
}
