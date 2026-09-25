import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { demoUploadDir } from "@/lib/demo/demo-db";
import { isDemoBackend } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyUploadToken } from "@/lib/upload-token";

function bucketFor(kind: "video" | "handout") {
  return kind === "video" ? "lesson-videos" : "lesson-handouts";
}

export async function POST(request: Request) {
  let cleanup: (() => Promise<unknown>) | undefined;
  try {
    const identity = await getIdentity();
    if (!identity) return NextResponse.json({ error: "انتهت الجلسة. سجّل الدخول مرة أخرى." }, { status: 401 });
    if (identity.role !== "teacher") return NextResponse.json({ error: "غير مسموح" }, { status: 403 });
    const { token } = await request.json() as { token?: string };
    const payload = token ? verifyUploadToken(token) : null;
    if (!payload || payload.userId !== identity.userId || !payload.lessonId || payload.kind === "submission") {
      return NextResponse.json({ error: "جلسة الرفع غير صالحة" }, { status: 403 });
    }
    if (payload.kind !== "video" && payload.kind !== "handout") {
      return NextResponse.json({ error: "نوع الملف غير مدعوم في Core 1.0" }, { status: 400 });
    }
    const mimeAllowed = payload.kind === "video"
      ? payload.mimeType === "video/mp4" || payload.mimeType === "video/webm"
      : payload.mimeType === "application/pdf";
    const extensionAllowed = payload.kind === "video"
      ? /\.(mp4|webm)$/iu.test(payload.objectPath)
      : /\.pdf$/iu.test(payload.objectPath);
    if (!mimeAllowed || !extensionAllowed) {
      return NextResponse.json({ error: "نوع أو امتداد الملف غير مدعوم في Core 1.0" }, { status: 400 });
    }

    if (isDemoBackend) {
      const filePath = path.join(demoUploadDir(), payload.objectPath);
      const info = await stat(filePath);
      if (!info.isFile() || info.size !== payload.sizeBytes) throw new Error("الملف المرفوع غير مكتمل");
      cleanup = () => rm(filePath, { force: true });
    } else {
      const bucket = bucketFor(payload.kind);
      const admin = createAdminSupabaseClient();
      const { data, error } = await admin.storage.from(bucket).info(payload.objectPath);
      if (error || !data) throw error ?? new Error("الملف غير موجود في التخزين");
      if (Number(data.metadata?.size ?? data.size ?? 0) !== payload.sizeBytes) throw new Error("حجم الملف المرفوع غير مطابق");
      cleanup = () => admin.storage.from(bucket).remove([payload.objectPath]);
    }

    const asset = await (await getStore()).attachAsset(identity, {
      kind: payload.kind,
      lessonId: payload.lessonPartId ? undefined : payload.lessonId,
      lessonPartId: payload.lessonPartId,
      title: payload.title,
      storagePath: payload.objectPath,
      originalFilename: payload.originalFilename,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
    });
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    if (cleanup) await cleanup().catch(() => undefined);
    console.error("upload_finalize_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "تعذر اعتماد الملف" }, { status: 400 });
  }
}
