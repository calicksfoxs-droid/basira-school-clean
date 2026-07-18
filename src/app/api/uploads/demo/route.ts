import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { demoUploadDir } from "@/lib/demo/demo-db";
import { isDemoBackend } from "@/lib/env";
import { verifyUploadToken } from "@/lib/upload-token";

export async function POST(request: Request) {
  if (!isDemoBackend) return NextResponse.json({ error: "غير متاح" }, { status: 404 });
  const identity = await requireRole("teacher");
  const formData = await request.formData();
  const tokenValue = formData.get("token");
  const fileValue = formData.get("file");
  if (typeof tokenValue !== "string" || !(fileValue instanceof File)) return NextResponse.json({ error: "رفع غير صالح" }, { status: 400 });
  const payload = verifyUploadToken(tokenValue);
  if (!payload || payload.userId !== identity.userId || payload.sizeBytes !== fileValue.size || payload.mimeType !== fileValue.type) return NextResponse.json({ error: "انتهت صلاحية الرفع" }, { status: 403 });
  const output = path.join(demoUploadDir(), payload.objectPath);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(await fileValue.arrayBuffer()));
  return NextResponse.json({ ok: true });
}
