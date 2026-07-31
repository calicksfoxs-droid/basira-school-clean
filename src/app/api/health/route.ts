import { NextResponse } from "next/server";
import { isDemoBackend } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? process.env.GIT_COMMIT?.slice(0, 12) ?? "local",
    timestamp: new Date().toISOString(),
  }, { status: database === "unreachable" ? 503 : 200, headers: { "cache-control": "no-store" } });
}
