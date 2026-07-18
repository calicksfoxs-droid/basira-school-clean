"use server";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createQuizSchema } from "@/domain/schemas";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { demoUploadDir } from "@/lib/demo/demo-db";
import { env, isDemoBackend } from "@/lib/env";
import { handleActionError, redirectNotice } from "./helpers";

export async function createQuizAction(payload: unknown) {
  try {
    const identity = await requireRole("teacher");
    const parsed = createQuizSchema.parse(payload);
    const quizId = await (await getStore()).createQuiz(identity, parsed);
    revalidatePath("/app/teacher");
    return { ok: true as const, quizId };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "تعذر إنشاء الاختبار" };
  }
}

const fileTypes = new Set(["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

export async function submitQuizFormAction(formData: FormData) {
  const quizId = String(formData.get("quizId") ?? "");
  let submissionId: string | undefined;
  const createdLocalPaths: string[] = [];
  try {
    const identity = await requireRole("student");
    const store = await getStore();
    const quiz = await store.getQuiz(identity, quizId);
    const answers = quiz.questions.map((question) => {
      if (question.type === "mcq") return { questionId: question.id, selectedOptionId: String(formData.get(`question_${question.id}`) ?? "") || undefined };
      if (question.type === "true_false") return { questionId: question.id, booleanValue: formData.get(`question_${question.id}`) === "true" };
      if (question.type === "essay_text") return { questionId: question.id, textValue: String(formData.get(`question_${question.id}`) ?? "") };
      return { questionId: question.id };
    });
    submissionId = await store.submitQuiz(identity, quizId, answers);
    for (const question of quiz.questions.filter((item) => item.type === "essay_file")) {
      const value = formData.get(`question_${question.id}`);
      if (!(value instanceof File) || value.size === 0) throw new Error("ارفع ملف الإجابة المطلوب");
      if (!fileTypes.has(value.type) || value.size > env.MAX_SUBMISSION_UPLOAD_MB * 1024 * 1024) throw new Error("ملف الإجابة غير مدعوم أو أكبر من الحد المسموح");
      const extension = value.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
      const storagePath = `${quiz.group.id}/${quiz.quiz.id}/${identity.userId}/${submissionId}/${randomUUID()}.${extension}`;
      const bytes = new Uint8Array(await value.arrayBuffer());
      if (isDemoBackend) {
        const fullPath = path.join(demoUploadDir(), storagePath);
        await mkdir(path.dirname(fullPath), { recursive: true });
        await writeFile(fullPath, bytes);
        createdLocalPaths.push(fullPath);
      }
      await store.attachSubmissionFile(identity, submissionId, question.id, { storagePath, originalFilename: value.name, mimeType: value.type, sizeBytes: value.size, bytes });
    }
    revalidatePath("/app/student");
    redirect(`/app/student/results/${submissionId}`);
  } catch (error) {
    if (submissionId) {
      try { const identity = await requireRole("student"); await (await getStore()).voidSubmission(identity, submissionId); } catch { /* best effort rollback */ }
    }
    await Promise.all(createdLocalPaths.map((file) => rm(file, { force: true }).catch(() => undefined)));
    handleActionError(error, `/app/student/quizzes/${quizId}`);
  }
}

export async function gradeSubmissionAction(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "");
  const pathValue = `/app/teacher/submissions/${submissionId}`;
  try {
    const identity = await requireRole("teacher");
    const store = await getStore();
    const details = await store.getSubmission(identity, submissionId);
    const scores: Record<string, number> = {};
    const feedback: Record<string, string> = {};
    for (const question of details.questions.filter((q) => q.type === "essay_text" || q.type === "essay_file")) {
      scores[question.id] = Number(formData.get(`score_${question.id}`) ?? 0);
      feedback[question.id] = String(formData.get(`feedback_${question.id}`) ?? "");
    }
    const release = formData.get("release") === "on";
    await store.gradeSubmission(identity, submissionId, scores, feedback, release);
    revalidatePath("/app");
    redirectNotice(pathValue, release ? "تم التصحيح وإصدار النتيجة" : "تم حفظ التصحيح");
  } catch (error) { handleActionError(error, pathValue); }
}
