import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

const READ_TIMEOUT_MS = 15_000;

async function resilientFetch(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const attempts = method === "GET" || method === "HEAD" ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const timeout = AbortSignal.timeout(READ_TIMEOUT_MS);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      return await fetch(input, { ...init, signal });
    } catch (error) {
      lastError = error;
      if (attempt + 1 === attempts || init?.signal?.aborted) throw error;
    }
  }

  throw lastError;
}

export function createAdminSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: resilientFetch },
  });
}
