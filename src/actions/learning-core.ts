"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import {
  createLearningSubjectSchema,
  createSubjectGroupSchema,
  createSubjectUnitSchema,
  createUnitLessonSchema,
  enrollStudentSchema,
  platformSettingsSchema,
  updateSubjectBannerSchema,
  updateSubjectCoverSchema,
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
const idSchema = z.string().uuid();

function databaseErrorSummary(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (!error || typeof error !== "object") return { message: String(error) };
  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message: typeof candidate.message === "string" ? candidate.message : "Unknown database error",
    details: typeof candidate.details === "string" ? candidate.details : undefined,
    hint: typeof candidate.hint === "string" ? candidate.hint : undefined,
  };
}

function failure(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    return { ok: false, error: "راجع البيانات المدخلة", fieldErrors: error.flatten().fieldErrors };
  }
  if (error instanceof AppError) return { ok: false, error: error.message };
  console.error("Learning core action failed", databaseErrorSummary(error));
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

/** Client-form adapter that preserves validation feedback instead of silently staying on the page. */
export async function createLearningSubjectWithStateAction(
  _previousState: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return createLearningSubjectAction(formData);
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

export async function updateLearningSubjectCoverAction(formData: FormData): Promise<ActionResult> {
  try {
    const identity = await requireRole("teacher");
    const input = updateSubjectCoverSchema.parse({
      subjectId: text(formData, "subjectId"), coverKey: text(formData, "coverKey"),
    });
    await getLearningCoreStore().updateSubjectCover(identity, input);
    revalidatePath("/app");
    return { ok: true, data: undefined, message: "تم حفظ غلاف المادة وظهر للطلاب" };
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

export async function publishLearningSubjectAction(formData: FormData): Promise<ActionResult> {
  try { const identity = await requireRole("admin", "teacher"); await getLearningCoreStore().publishLearningSubject(identity, idSchema.parse(text(formData, "subjectId"))); revalidatePath("/app"); return { ok: true, data: undefined, message: "تم نشر المادة" }; } catch (error) { return failure(error); }
}
export async function publishLearningUnitAction(formData: FormData): Promise<ActionResult> {
  try { const identity = await requireRole("admin", "teacher"); await getLearningCoreStore().publishSubjectUnit(identity, idSchema.parse(text(formData, "unitId"))); revalidatePath("/app"); return { ok: true, data: undefined, message: "تم نشر الوحدة" }; } catch (error) { return failure(error); }
}
export async function publishLearningLessonAction(formData: FormData): Promise<ActionResult> {
  try { const identity = await requireRole("teacher"); await getLearningCoreStore().publishUnitLesson(identity, idSchema.parse(text(formData, "lessonId"))); revalidatePath("/app"); return { ok: true, data: undefined, message: "تم نشر الدرس" }; } catch (error) { return failure(error); }
}
export async function completeLearningLessonAction(formData: FormData): Promise<ActionResult> {
  try { const identity = await requireRole("student"); await getLearningCoreStore().completeLearningLesson(identity, idSchema.parse(text(formData, "lessonId"))); revalidatePath("/app"); return { ok: true, data: undefined, message: "أحسنت! تم تسجيل إنجاز الدرس" }; } catch (error) { return failure(error); }
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

// Adapters for native server-rendered forms. ActionResult-returning variants
// above remain available to interactive clients that use useActionState.
export async function updateLearningSubjectBannerFormAction(formData: FormData): Promise<void> { await updateLearningSubjectBannerAction(formData); }
export async function createLearningGroupFormAction(formData: FormData): Promise<void> { await createLearningGroupAction(formData); }
export async function createLearningUnitFormAction(formData: FormData): Promise<void> { await createLearningUnitAction(formData); }
export async function createLearningLessonFormAction(formData: FormData): Promise<void> { await createLearningLessonAction(formData); }
export async function enrollExistingStudentFormAction(formData: FormData): Promise<void> { await enrollExistingStudentAction(formData); }
export async function publishLearningSubjectFormAction(formData: FormData): Promise<void> { await publishLearningSubjectAction(formData); }
export async function publishLearningUnitFormAction(formData: FormData): Promise<void> { await publishLearningUnitAction(formData); }
export async function publishLearningLessonFormAction(formData: FormData): Promise<void> { await publishLearningLessonAction(formData); }
export async function completeLearningLessonFormAction(formData: FormData): Promise<void> { await completeLearningLessonAction(formData); }
export async function updatePlatformSettingsFormAction(formData: FormData): Promise<void> { await updatePlatformSettingsAction(formData); }
export async function updateUserPreferencesFormAction(formData: FormData): Promise<void> { await updateUserPreferencesAction(formData); }
