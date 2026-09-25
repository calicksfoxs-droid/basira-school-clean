import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth";
import { env, hasR2VideoStorage, isDemoBackend } from "@/lib/env";
import { createR2PresignedUrl } from "@/lib/r2-storage";
import { verifyUploadToken } from "@/lib/upload-token";

export async function PUT(request: Request) {
  try {
    if (isDemoBackend || env.VIDEO_STORAGE_PROVIDER !== "r2" || !hasR2VideoStorage()) {
      return NextResponse.json({ error: "تخزين R2 غير متاح" }, { status: 404 });
    }

    const identity = await getIdentity();
    if (!identity) return NextResponse.json({ error: "انتهت الجلسة. سجّل الدخول مرة أخرى." }, { status: 401 });
    if (identity.role !== "teacher") return NextResponse.json({ error: "غير مسموح" }, { status: 403 });

    const tokenValue = request.headers.get("x-basira-upload-token");
    const payload = tokenValue ? verifyUploadToken(tokenValue) : null;
    if (
      !payload ||
      payload.storageProvider !== "r2" ||
      payload.userId !== identity.userId ||
      payload.kind !== "video" ||
      !payload.lessonId
    ) {
      return NextResponse.json({ error: "جلسة الرفع غير صالحة" }, { status: 403 });
    }

    if (payload.sizeBytes > env.MAX_VIDEO_UPLOAD_MB * 1024 * 1024) {
      return NextResponse.json({ error: `حجم الفيديو يتجاوز ${env.MAX_VIDEO_UPLOAD_MB} MB` }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType !== payload.mimeType || (contentType !== "video/mp4" && contentType !== "video/webm")) {
      return NextResponse.json({ error: "نوع الفيديو لا يطابق جلسة الرفع" }, { status: 400 });
    }

    if (!request.body) return NextResponse.json({ error: "ملف الفيديو غير موجود" }, { status: 400 });

    const target = createR2PresignedUrl("PUT", payload.objectPath, 15 * 60);
    const upstream = await fetch(target, {
      method: "PUT",
      headers: { "content-type": payload.mimeType },
      body: request.body,
      redirect: "manual",
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    if (!upstream.ok) {
      console.error("r2_upload_failed", upstream.status);
      return NextResponse.json({ error: "فشل رفع الفيديو إلى التخزين" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("r2_upload_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "تعذر رفع الفيديو إلى التخزين" }, { status: 500 });
  }
}
