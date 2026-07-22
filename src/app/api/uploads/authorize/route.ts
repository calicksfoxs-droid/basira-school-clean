import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { env, isDemoBackend } from "@/lib/env";
import { getStore } from "@/lib/data";
import { createUploadToken } from "@/lib/upload-token";

const allowedVideo = new Set(["video/mp4", "video/webm"]);
export async function POST(request: Request) {
  try {
    const identity = await requireRole("teacher");
    const body = await request.json() as { lessonId?: string; lessonPartId?: string; kind?: "video" | "handout"; fileName?: string; mimeType?: string; sizeBytes?: number; title?: string };
    if (!body.lessonId || !body.kind || !body.fileName || !body.mimeType || !body.sizeBytes) return NextResponse.json({ error: "بيانات الرفع ناقصة" }, { status: 400 });
    const details = await (await getStore()).getLesson(identity, body.lessonId);
    if (body.lessonPartId && !details.parts.some((part) => part.id === body.lessonPartId)) return NextResponse.json({ error: "جزء الدرس غير صالح" }, { status: 400 });
    if ((details.lesson.structureMode === "direct" && body.lessonPartId) || (details.lesson.structureMode === "parts" && !body.lessonPartId)) return NextResponse.json({ error: "اختر مكان الملف الصحيح داخل بنية الدرس" }, { status: 400 });
    const maxMb = body.kind === "video" ? env.MAX_VIDEO_UPLOAD_MB : env.MAX_HANDOUT_UPLOAD_MB;
    if (body.sizeBytes > maxMb * 1024 * 1024) return NextResponse.json({ error: `حجم الملف يتجاوز ${maxMb} MB` }, { status: 400 });
    if (body.kind === "video" && !allowedVideo.has(body.mimeType)) return NextResponse.json({ error: "الفيديو يجب أن يكون MP4 أو WebM" }, { status: 400 });
    if (body.kind === "handout" && body.mimeType !== "application/pdf") return NextResponse.json({ error: "الملزمة يجب أن تكون PDF" }, { status: 400 });
    const extension = body.kind === "video" ? (body.mimeType === "video/webm" ? "webm" : "mp4") : "pdf";
    const bucket = body.kind === "video" ? "lesson-videos" : "lesson-handouts";
    const container = body.lessonPartId ?? "direct";
    // Legacy content is scoped by group; Learning Core content is scoped by its
    // teacher-owned subject. The storage RLS migration validates both shapes.
    const scopeId = details.group?.id ?? details.subject.id;
    const objectPath = `${scopeId}/${details.subject.id}/${details.lesson.id}/${container}/${randomUUID()}.${extension}`;
    const token = createUploadToken({ userId: identity.userId, kind: body.kind, lessonId: body.lessonId, lessonPartId: body.lessonPartId, objectPath, originalFilename: body.fileName, mimeType: body.mimeType, sizeBytes: body.sizeBytes, title: body.title || body.fileName, exp: Date.now() + 20 * 60 * 1000 });
    const storageUrl = !isDemoBackend && env.NEXT_PUBLIC_SUPABASE_URL
      ? env.NEXT_PUBLIC_SUPABASE_URL.replace(".supabase.co", ".storage.supabase.co")
      : undefined;
    return NextResponse.json({ mode: isDemoBackend ? "demo" : "supabase", token, bucket, objectPath, storageUrl });
  } catch (error) {
    console.error("upload_authorize_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "تعذر تجهيز الرفع" }, { status: 403 });
  }
}
