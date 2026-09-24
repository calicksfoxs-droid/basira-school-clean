import { NextResponse } from "next/server";
import { isDemoBackend } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { BUILD_COMMIT } from "@/generated/build-info";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  let database: "ready" | "unreachable" | undefined;
  if (deep) {
    if (isDemoBackend) database = "ready";
    else {
      try {
        const { error } = await createAdminSupabaseClient().from("subjects").select("id").limit(1);
        database = error ? "unreachable" : "ready";
      } catch {
        database = "unreachable";
      }
    }
  }
  return NextResponse.json({
    ok: database !== "unreachable",
    service: "basira-school-platform",
    backend: isDemoBackend ? "demo" : "supabase",
    ...(database ? { database } : {}),
    commit: BUILD_COMMIT === "local" ? "local" : BUILD_COMMIT.slice(0, 12),
    timestamp: new Date().toISOString(),
  }, { status: database === "unreachable" ? 503 : 200, headers: { "cache-control": "no-store" } });
}
