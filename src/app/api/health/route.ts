import { NextResponse } from "next/server";
import { isDemoBackend } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "basira-school-platform",
    backend: isDemoBackend ? "demo" : "supabase",
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? process.env.GIT_COMMIT?.slice(0, 12) ?? "local",
    timestamp: new Date().toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
