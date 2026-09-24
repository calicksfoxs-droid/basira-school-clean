import "server-only";

import { createHash } from "node:crypto";
import { isDemoBackend } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

interface Bucket {
  failures: number;
  windowEndsAt: number;
  blockedUntil?: number;
}

type RateLimitState = { allowed: boolean; retryAfterSeconds: number };

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

function demoCheck(key: string): RateLimitState {
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

function demoRecord(key: string): RateLimitState {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket: Bucket = !existing || existing.windowEndsAt <= now
    ? { failures: 1, windowEndsAt: now + WINDOW_MS }
    : { ...existing, failures: existing.failures + 1 };
  if (bucket.failures >= MAX_FAILURES) bucket.blockedUntil = now + BLOCK_MS;
  buckets.set(key, bucket);
  return bucket.blockedUntil && bucket.blockedUntil > now
    ? { allowed: false, retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000) }
    : { allowed: true, retryAfterSeconds: 0 };
}

function keyHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function rowState(row: unknown): RateLimitState {
  const record = (Array.isArray(row) ? row[0] : row) as Record<string, unknown> | undefined;
  if (!record) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: Boolean(record.allowed),
    retryAfterSeconds: Number(record.retry_after_seconds ?? 0),
  };
}

export async function checkLoginRateLimit(key: string): Promise<RateLimitState> {
  if (isDemoBackend) return demoCheck(key);

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("check_login_rate_limit_v1", { p_key_hash: keyHash(key) });
  if (error) {
    console.error("shared_login_rate_limit_check_failed", error.message);
    return { allowed: false, retryAfterSeconds: 60 };
  }
  return rowState(data);
}

export async function recordLoginFailure(key: string): Promise<RateLimitState> {
  if (isDemoBackend) return demoRecord(key);

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("record_login_failure_v1", { p_key_hash: keyHash(key) });
  if (error) {
    console.error("shared_login_rate_limit_record_failed", error.message);
    return { allowed: false, retryAfterSeconds: 60 };
  }
  return rowState(data);
}

export async function clearLoginFailures(key: string): Promise<void> {
  if (isDemoBackend) {
    buckets.delete(key);
    return;
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("clear_login_failures_v1", { p_key_hash: keyHash(key) });
  if (error) console.error("shared_login_rate_limit_clear_failed", error.message);
}
