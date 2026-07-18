"use server";
import { revalidatePath } from "next/cache";
import { createLessonPartSchema, createLessonSchema, createSubjectSchema } from "@/domain/schemas";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { formText, handleActionError, redirectNotice, returnPath } from "./helpers";

export async function createSubjectAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/groups");
  try {
    const identity = await requireRole("teacher");
    const parsed = createSubjectSchema.parse({ groupId: formText(formData, "groupId"), title: formText(formData, "title"), description: formText(formData, "description") });
    const subject = await (await getStore()).createSubject(identity, parsed);
    revalidatePath("/app/teacher");
    redirectNotice(`/app/teacher/subjects/${subject.id}`, "تم إنشاء المادة");
  } catch (error) { handleActionError(error, path); }
}

export async function createLessonAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/groups");
  try {
    const identity = await requireRole("teacher");
    const parsed = createLessonSchema.parse({ subjectId: formText(formData, "subjectId"), title: formText(formData, "title"), description: formText(formData, "description"), structureMode: formText(formData, "structureMode") });
    const lesson = await (await getStore()).createLesson(identity, parsed);
    revalidatePath("/app/teacher");
    redirectNotice(`/app/teacher/lessons/${lesson.id}/edit`, "تم إنشاء الدرس كمسودة");
  } catch (error) { handleActionError(error, path); }
}

export async function createLessonPartAction(formData: FormData) {
  const lessonId = formText(formData, "lessonId");
  const path = returnPath(formData, `/app/teacher/lessons/${lessonId}/edit`);
  try {
    const identity = await requireRole("teacher");
    const parsed = createLessonPartSchema.parse({ lessonId, title: formText(formData, "title"), description: formText(formData, "description") });
    await (await getStore()).createLessonPart(identity, parsed);
    revalidatePath(path);
    redirectNotice(path, "تمت إضافة جزء الدرس");
  } catch (error) { handleActionError(error, path); }
}

export async function publishLessonAction(formData: FormData) {
  const lessonId = formText(formData, "lessonId");
  const path = returnPath(formData, `/app/teacher/lessons/${lessonId}/edit`);
  try {
    const identity = await requireRole("teacher");
    await (await getStore()).publishLesson(identity, lessonId);
    revalidatePath("/app");
    redirectNotice(path, "تم نشر الدرس للطلاب");
  } catch (error) { handleActionError(error, path); }
}
