import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { demoUploadDir } from "@/lib/demo/demo-db";
import { isDemoBackend } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireIdentity();
    const asset = await (await getStore()).getAsset(identity, (await params).id);
    const supportedLessonAsset =
      (asset.kind === "video" && (asset.mimeType === "video/mp4" || asset.mimeType === "video/webm")) ||
      (asset.kind === "handout" && asset.mimeType === "application/pdf");
    if (!supportedLessonAsset) {
      return NextResponse.json({ error: "الملف غير مدعوم في Core 1.0" }, { status: 404 });
    }
    if (isDemoBackend) {
      const buffer = await readFile(path.join(demoUploadDir(), asset.storagePath));
      return new NextResponse(buffer, { headers: { "content-type": asset.mimeType, "content-disposition": `${asset.kind === "video" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(asset.originalFilename)}`, "cache-control": "private, no-store" } });
    }
    const bucket = asset.kind === "video" ? "lesson-videos" : "lesson-handouts";
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(asset.storagePath, 60);
    if (error) throw error;
    return NextResponse.redirect(data.signedUrl);
  } catch { return NextResponse.json({ error: "الملف غير متاح" }, { status: 404 }); }
}
