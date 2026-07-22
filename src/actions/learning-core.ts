"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  createLearningSubjectSchema,
  createSubjectGroupSchema,
  createSubjectUnitSchema,
  createUnitLessonSchema,
  enrollStudentSchema,
  platformSettingsSchema,
  updateSubjectBannerSchema,
  userPreferencesSchema,
} from "@/domain/core-schemas";
import type { ActionResult } from "@/lib/action-result";
import { requireIdentity, requireRole } from "@/lib/auth";
import { AppError } from "@/lib/data/errors";
import { getLearningCoreStore } from "@/lib/core";
import type { RevealedStudentEnrollmentReference } from "@/domain/core-models";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optional(value: string) { return value.trim() || undefined; }

function failure(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    return { ok: false, error: "راجع البيانات المدخلة", fieldErrors: error.flatten().fieldErrors };
  }
  if (error instanceof AppError) return { ok: false, error: error.message };
  console.error("Learning core action failed", error instanceof Error ? error.message : "Unknown error");
  return { ok: false, error: "تعذر إتمام العملية. حاول مرة أخرى." };
}

export async function createLearningSubjectAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requireRole("teacher");
    const input = createLearningSubjectSchema.parse({
      title: text(formData, "title"), description: optional(text(formData, "description")),
    });
    const subject = await getLearningCoreStore().createLearningSubject(identity, input);
    revalidatePath("/app");
    return { ok: true, data: { id: subject.id }, message: "تم إنشاء المادة" };
  } catch (error) { return failure(error); }
}

export async function updateLearningSubjectBannerAction(formData: FormData): Promise<ActionResult> {
  try {
    const identity = await requireRole("admin", "teacher");
    const input = updateSubjectBannerSchema.parse({
      subjectId: text(formData, "subjectId"), title: optional(text(formData, "title")),
      body: optional(text(formData, "body")), ctaLabel: optional(text(formData, "ctaLabel")),
      ctaPath: optional(text(formData, "ctaPath")),
    });
    await getLearningCoreStore().updateSubjectBanner(identity, input);
    revalidatePath("/app");
    return { ok: true, data: undefined, message: "تم تحديث إعلان المادة" };
  } catch (error) { return failure(error); }
}

export async function createLearningGroupAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requireRole("admin", "teacher");
    const input = createSubjectGroupSchema.parse({
      subjectId: text(formData, "subjectId"), name: text(formData, "name"),
      description: optional(text(formData, "description")),
    });
    const group = await getLearningCoreStore().createSubjectGroup(identity, input);
    revalidatePath("/app");
    return { ok: true, data: { id: group.id }, message: "تم إنشاء المجموعة" };
  } catch (error) { return failure(error); }
}

export async function createLearningUnitAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requireRole("admin", "teacher");
    const input = createSubjectUnitSchema.parse({
      subjectId: text(formData, "subjectId"), title: text(formData, "title"),
      description: optional(text(formData, "description")),
    });
    const unit = await getLearningCoreStore().createSubjectUnit(identity, input);
    revalidatePath("/app");
    return { ok: true, data: { id: unit.id }, message: "تم إنشاء الوحدة" };
  } catch (error) { return failure(error); }
}

export async function createLearningLessonAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requireRole("admin", "teacher");
    const input = createUnitLessonSchema.parse({
      unitId: text(formData, "unitId"), title: text(formData, "title"),
      description: optional(text(formData, "description")), structureMode: text(formData, "structureMode"),
    });
    const lesson = await getLearningCoreStore().createUnitLesson(identity, input);
    revalidatePath("/app");
    return { ok: true, data: { id: lesson.id }, message: "تم إنشاء الدرس" };
  } catch (error) { return failure(error); }
}

export async function enrollExistingStudentAction(formData: FormData): Promise<ActionResult<{ studentId: string; displayName: string }>> {
  try {
    const identity = await requireRole("admin", "teacher");
    const input = enrollStudentSchema.parse({
      groupId: text(formData, "groupId"), enrollmentReference: text(formData, "enrollmentReference"),
    });
    const student = await getLearningCoreStore().enrollStudentByReference(identity, input);
    revalidatePath("/app");
    return { ok: true, data: student, message: "تمت إضافة الطالب" };
  } catch (error) { return failure(error); }
}

export async function rotateMyEnrollmentReferenceAction(): Promise<ActionResult<RevealedStudentEnrollmentReference>> {
  try {
    const identity = await requireRole("student");
    const result = await getLearningCoreStore().rotateEnrollmentReference(identity, identity.userId);
    return { ok: true, data: result, message: "احفظ المعرّف الآن؛ لن يظهر كاملًا مرة أخرى." };
  } catch (error) { return failure(error); }
}

export async function updatePlatformSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    const identity = await requireRole("admin");
    const input = platformSettingsSchema.parse({
      platformName: text(formData, "platformName"), timezone: text(formData, "timezone"),
      maintenanceMessage: optional(text(formData, "maintenanceMessage")),
    });
    await getLearningCoreStore().updatePlatformSettings(identity, input);
    revalidatePath("/app");
    return { ok: true, data: undefined, message: "تم حفظ إعدادات المنصة" };
  } catch (error) { return failure(error); }
}

export async function updateUserPreferencesAction(formData: FormData): Promise<ActionResult> {
  try {
    const identity = await requireIdentity();
    const input = userPreferencesSchema.parse({
      theme: text(formData, "theme"), reducedMotion: text(formData, "reducedMotion") === "true", locale: "ar",
    });
    await getLearningCoreStore().updateUserPreferences(identity, input);
    revalidatePath("/app");
    return { ok: true, data: undefined, message: "تم حفظ تفضيلاتك" };
  } catch (error) { return failure(error); }
}
