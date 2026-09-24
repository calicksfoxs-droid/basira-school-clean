"use server";
import { revalidatePath } from "next/cache";
import { createLessonPartSchema } from "@/domain/schemas";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { AppError } from "@/lib/data/errors";
import { CORE1_CAPABILITIES, CORE1_DISABLED_MESSAGE } from "@/lib/release/core1-capabilities";
import { formText, handleActionError, redirectNotice, returnPath } from "./helpers";

export async function createSubjectAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/grades");
  try {
    await requireRole("teacher");
    if (!CORE1_CAPABILITIES.legacyNewAuthoring) throw new AppError(CORE1_DISABLED_MESSAGE, "CORE1_DISABLED", 409);
  } catch (error) {
    handleActionError(error, path);
  }
  redirectNotice(path, CORE1_DISABLED_MESSAGE, "error");
}

export async function createLessonAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/grades");
  try {
    await requireRole("teacher");
    if (!CORE1_CAPABILITIES.legacyNewAuthoring) throw new AppError(CORE1_DISABLED_MESSAGE, "CORE1_DISABLED", 409);
  } catch (error) {
    handleActionError(error, path);
  }
  redirectNotice(path, CORE1_DISABLED_MESSAGE, "error");
}

export async function createLessonPartAction(formData: FormData) {
  const lessonId = formText(formData, "lessonId");
  const path = returnPath(formData, `/app/teacher/lessons/${lessonId}/edit`);
  try {
    const identity = await requireRole("teacher");
    const parsed = createLessonPartSchema.parse({
      lessonId,
      title: formText(formData, "title"),
      description: formText(formData, "description")
    });
    await (await getStore()).createLessonPart(identity, parsed);
    revalidatePath(path);
  } catch (error) {
    handleActionError(error, path);
  }

  redirectNotice(path, "تمت إضافة جزء الدرس");
}

export async function publishLessonAction(formData: FormData) {
  const lessonId = formText(formData, "lessonId");
  const path = returnPath(formData, `/app/teacher/lessons/${lessonId}/edit`);
  try {
    const identity = await requireRole("teacher");
    await (await getStore()).publishLesson(identity, lessonId);
    revalidatePath("/app");
  } catch (error) {
    handleActionError(error, path);
  }

  redirectNotice(path, "تم نشر الدرس للطلاب");
}
