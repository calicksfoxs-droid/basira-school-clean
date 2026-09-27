"use server";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { createQuizSchema } from "@/domain/schemas";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { AppError } from "@/lib/data/errors";
import { CORE1_CAPABILITIES, CORE1_DISABLED_MESSAGE } from "@/lib/release/core1-capabilities";
import { handleActionError, redirectNotice } from "./helpers";

export async function createQuizAction(payload: unknown) {
  try {
    const identity = await requireRole("teacher");
    const parsed = createQuizSchema.parse(payload);
    const quizId = await (await getStore()).createQuiz(identity, parsed);
    revalidatePath("/app/teacher");
    return { ok: true as const, quizId };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "تعذر إنشاء الاختبار" };
  }
}

export async function submitQuizFormAction(formData: FormData) {
  const quizId = String(formData.get("quizId") ?? "");
  let submissionId: string | undefined;
  let identity;
  let store;

  try {
    identity = await requireRole("student");
    store = await getStore();
    const quiz = await store.getQuiz(identity, quizId);
    if (!quiz.questions.every((question) => question.type === "mcq" || question.type === "true_false")) {
      throw new AppError(CORE1_DISABLED_MESSAGE, "CORE1_DISABLED", 409);
    }

    const answers = quiz.questions.map((question) => {
      const value = formData.get(`question_${question.id}`);

      if (question.type === "mcq") {
        if (typeof value !== "string" || !value) {
          throw new AppError("أجب عن جميع الأسئلة قبل التسليم", "QUIZ_ANSWER_REQUIRED", 400);
        }
        return { questionId: question.id, selectedOptionId: value };
      }

      // Do not coerce a missing True/False field to `false`. The server must
      // distinguish an unanswered question from an explicit False answer even
      // if browser-side `required` validation is bypassed.
      if (value !== "true" && value !== "false") {
        throw new AppError("أجب عن جميع الأسئلة قبل التسليم", "QUIZ_ANSWER_REQUIRED", 400);
      }
      return { questionId: question.id, booleanValue: value === "true" };
    });

    submissionId = await store.submitQuiz(identity, quizId, answers);
    revalidatePath("/app/student");
  } catch (error) {
    if (submissionId && identity) {
      try { await store?.voidSubmission(identity, submissionId); } catch { /* best effort rollback */ }
    }
    handleActionError(error, `/app/student/quizzes/${quizId}`);
  }

  redirect(`/app/student/results/${submissionId}`);
}

export async function gradeSubmissionAction(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "");
  const pathValue = `/app/teacher/submissions/${submissionId}`;
  let notice = "تم حفظ التصحيح";

  try {
    const identity = await requireRole("teacher");
    if (!CORE1_CAPABILITIES.manualGrading) throw new AppError(CORE1_DISABLED_MESSAGE, "CORE1_DISABLED", 409);
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
    notice = release ? "تم التصحيح وإصدار النتيجة" : "تم حفظ التصحيح";
    revalidatePath("/app");
  } catch (error) {
    handleActionError(error, pathValue);
  }

  redirectNotice(pathValue, notice);
}
