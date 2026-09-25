"use strict";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Identity } from "@/domain/models";
import type { BasiraStore } from "@/lib/data/contracts";
import { submitQuizFormAction } from "@/actions/quiz";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/auth");
vi.mock("@/lib/data");
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
  unstable_rethrow: vi.fn((error: unknown) => {
    if (error instanceof Error && error.message === "REDIRECT") throw error;
  }),
}));
vi.mock("next/cache");

const mockRequireRole = vi.mocked(requireRole);
const mockGetStore = vi.mocked(getStore);
const mockRedirect = vi.mocked(redirect);
const mockRevalidatePath = vi.mocked(revalidatePath);

const mockStore = {
  getQuiz: vi.fn(),
  submitQuiz: vi.fn(),
  attachSubmissionFile: vi.fn(),
  voidSubmission: vi.fn(),
};

const mockIdentity: Identity = {
  userId: "student-1",
  role: "student",
  displayName: "Test Student",
  status: "active"
};

const objectiveQuiz = {
  quiz: { id: "quiz-1" },
  group: { id: "group-1" },
  lesson: { subjectId: "subject-1" },
  questions: [
    { id: "q1", type: "mcq" },
    { id: "q2", type: "true_false" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(mockIdentity);
  mockGetStore.mockResolvedValue(mockStore as unknown as BasiraStore);
  mockStore.getQuiz.mockResolvedValue(objectiveQuiz);
  mockStore.submitQuiz.mockResolvedValue("submission-1");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitQuizFormAction", () => {
  it("submits an objective Core 1.0 quiz and redirects to the released result", async () => {
    const formData = new FormData();
    formData.append("quizId", "quiz-1");
    formData.append("question_q1", "option-1");
    formData.append("question_q2", "true");

    await expect(submitQuizFormAction(formData)).rejects.toThrow("REDIRECT");

    expect(mockStore.submitQuiz).toHaveBeenCalledWith(mockIdentity, "quiz-1", [
      { questionId: "q1", selectedOptionId: "option-1" },
      { questionId: "q2", booleanValue: true },
    ]);
    expect(mockStore.attachSubmissionFile).not.toHaveBeenCalled();
    expect(mockStore.voidSubmission).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app/student");
    expect(mockRedirect).toHaveBeenCalledWith("/app/student/results/submission-1");
  });

  it("rejects a legacy essay quiz before creating a Core 1.0 submission", async () => {
    mockStore.getQuiz.mockResolvedValue({
      ...objectiveQuiz,
      questions: [
        { id: "q1", type: "mcq" },
        { id: "q2", type: "essay_file" },
      ],
    });

    const formData = new FormData();
    formData.append("quizId", "quiz-1");
    formData.append("question_q1", "option-1");

    await expect(submitQuizFormAction(formData)).rejects.toThrow("REDIRECT");

    expect(mockStore.submitQuiz).not.toHaveBeenCalled();
    expect(mockStore.attachSubmissionFile).not.toHaveBeenCalled();
    expect(mockStore.voidSubmission).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining("/app/student/quizzes/quiz-1?error="));
  });
});
