"use server";
import { revalidatePath } from "next/cache";
import { createLessonPartSchema, createLessonSchema, createSubjectSchema } from "@/domain/schemas";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { formText, handleActionError, redirectNotice, returnPath } from "./helpers";

export async function createSubjectAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/groups");
  let destination = path;

  try {
    const identity = await requireRole("teacher");
    const parsed = createSubjectSchema.parse({
      groupId: formText(formData, "groupId"),
      title: formText(formData, "title"),
      description: formText(formData, "description")
    });
    const subject = await (await getStore()).createSubject(identity, parsed);
    destination = `/app/teacher/subjects/${subject.id}`;
    revalidatePath("/app/teacher");
  } catch (error) {
    handleActionError(error, path);
  }

  redirectNotice(destination, "تم إنشاء المادة");
}

export async function createLessonAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/groups");
  let destination = path;

  try {
    const identity = await requireRole("teacher");
    const parsed = createLessonSchema.parse({
      subjectId: formText(formData, "subjectId"),
      title: formText(formData, "title"),
      description: formText(formData, "description"),
      structureMode: formText(formData, "structureMode")
    });
    const lesson = await (await getStore()).createLesson(identity, parsed);
    destination = `/app/teacher/lessons/${lesson.id}/edit`;
    revalidatePath("/app/teacher");
  } catch (error) {
    handleActionError(error, path);
  }

  redirectNotice(destination, "تم إنشاء الدرس كمسودة");
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
