import "server-only";

interface Bucket {
  failures: number;
  windowEndsAt: number;
  blockedUntil?: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

function prune(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if ((bucket.blockedUntil ?? bucket.windowEndsAt) < now) buckets.delete(key);
  }
}

export function checkLoginRateLimit(key: string) {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket) return { allowed: true, retryAfterSeconds: 0 };
  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000) };
  }
  if (bucket.windowEndsAt <= now) {
    buckets.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket: Bucket = !existing || existing.windowEndsAt <= now
    ? { failures: 1, windowEndsAt: now + WINDOW_MS }
    : { ...existing, failures: existing.failures + 1 };
  if (bucket.failures >= MAX_FAILURES) bucket.blockedUntil = now + BLOCK_MS;
  buckets.set(key, bucket);
}

export function clearLoginFailures(key: string) {
  buckets.delete(key);
}
