import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireIdentity, requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";
import { demoUploadDir, mutateDemoDatabase, readDemoDatabase } from "@/lib/demo/demo-db";
import { isDemoBackend } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
type Row = Record<string, unknown>;

async function unitRow(unitId: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("subject_units").select("id,subject_id,cover_path").eq("id", unitId).single();
  if (error) throw error;
  return { admin, unit: data as Row };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const identity = await requireRole("teacher");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !TYPES.has(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 MB" }, { status: 400 });
    }
    const extension = TYPES.get(file.type)!;
    if (isDemoBackend) {
      const database = await readDemoDatabase();
      const unit = database.learningUnits.find((candidate) => candidate.id === id);
      const subject = unit && database.learningSubjects.find((candidate) => candidate.id === unit.subjectId);
      if (!unit || !subject || subject.teacherId !== identity.userId) return NextResponse.json({ error: "غير مسموح" }, { status: 403 });
      const objectPath = `unit-covers/${identity.userId}/${subject.id}/${unit.id}/${randomUUID()}.${extension}`;
      const target = path.join(demoUploadDir(), objectPath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, new Uint8Array(await file.arrayBuffer()));
      const previous = unit.coverPath;
      await mutateDemoDatabase((mutable) => { const found = mutable.learningUnits.find((candidate) => candidate.id === id); if (found) found.coverPath = objectPath; });
      if (previous) await rm(path.join(demoUploadDir(), previous), { force: true }).catch(() => undefined);
      return NextResponse.json({ ok: true });
    }
    const { admin, unit } = await unitRow(id);
    const { data: subject, error: subjectError } = await admin.from("subjects").select("id,owner_teacher_id").eq("id", String(unit.subject_id)).single();
    if (subjectError || String((subject as Row).owner_teacher_id) !== identity.userId) return NextResponse.json({ error: "غير مسموح" }, { status: 403 });
    const objectPath = `${identity.userId}/${String(unit.subject_id)}/${id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from("unit-covers").upload(objectPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error: updateError } = await admin.from("subject_units").update({ cover_path: objectPath }).eq("id", id);
    if (updateError) { await admin.storage.from("unit-covers").remove([objectPath]); throw updateError; }
    if (unit.cover_path) await admin.storage.from("unit-covers").remove([String(unit.cover_path)]).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("unit_cover_upload_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "تعذر رفع صورة الوحدة" }, { status: 400 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const identity = await requireIdentity();
    if (isDemoBackend) {
      const database = await readDemoDatabase();
      const unit = database.learningUnits.find((candidate) => candidate.id === id);
      if (!unit?.coverPath) return new NextResponse(null, { status: 404 });
      await getLearningCoreStore().getLearningSubject(identity, unit.subjectId);
      const bytes = await readFile(path.join(demoUploadDir(), unit.coverPath));
      return new NextResponse(bytes, { headers: { "Content-Type": unit.coverPath.endsWith(".png") ? "image/png" : unit.coverPath.endsWith(".jpg") ? "image/jpeg" : "image/webp", "Cache-Control": "private, max-age=300" } });
    }
    const { admin, unit } = await unitRow(id);
    if (!unit.cover_path) return new NextResponse(null, { status: 404 });
    await getLearningCoreStore().getLearningSubject(identity, String(unit.subject_id));
    const { data, error } = await admin.storage.from("unit-covers").createSignedUrl(String(unit.cover_path), 300);
    if (error) throw error;
    return NextResponse.redirect(data.signedUrl);
  } catch { return new NextResponse(null, { status: 404 }); }
}
