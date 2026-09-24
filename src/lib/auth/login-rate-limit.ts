import "server-only";
import { createHmac } from "node:crypto";
import { env, isDemoBackend } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

interface DemoBucket {
  attempts: number;
  windowEndsAt: number;
  blockedUntil?: number;
}

const demoBuckets = new Map<string, DemoBucket>();
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function keyHash(key: string) {
  return createHmac("sha256", env.BASIRA_APP_SECRET).update(key).digest("hex");
}

function beginDemoAttempt(key: string) {
  const now = Date.now();
  const existing = demoBuckets.get(key);

  if (!existing) {
    demoBuckets.set(key, { attempts: 1, windowEndsAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil - now) / 1000)),
    };
  }

  if (existing.windowEndsAt <= now) {
    demoBuckets.set(key, { attempts: 1, windowEndsAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.attempts >= MAX_ATTEMPTS) {
    const blockedUntil = now + BLOCK_MS;
    demoBuckets.set(key, { ...existing, blockedUntil });
    return { allowed: false, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000) };
  }

  demoBuckets.set(key, { ...existing, attempts: existing.attempts + 1 });
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function beginLoginAttempt(key: string) {
  if (isDemoBackend) return beginDemoAttempt(key);

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("begin_login_attempt_v1", {
    p_key_hash: keyHash(key),
  });

  if (error) {
    console.error("Shared login rate-limit check failed", error.message);
    return { allowed: false, retryAfterSeconds: 60 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    console.error("Shared login rate-limit check returned no result");
    return { allowed: false, retryAfterSeconds: 60 };
  }

  return {
    allowed: Boolean(row.allowed),
    retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
  };
}

export async function clearLoginAttempts(key: string) {
  if (isDemoBackend) {
    demoBuckets.delete(key);
    return;
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("clear_login_attempts_v1", {
    p_key_hash: keyHash(key),
  });
  if (error) console.error("Shared login rate-limit clear failed", error.message);
}
