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
}));
vi.mock("next/cache");
const { mockMkdir, mockRm, mockWriteFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockRm: vi.fn().mockResolvedValue(undefined),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    mkdir: mockMkdir,
    rm: mockRm,
    writeFile: mockWriteFile,
  };
});

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
const mockQuiz = {
  quiz: { id: "quiz-1" },
  group: { id: "group-1" },
  questions: [
    { id: "q1", type: "mcq" },
    { id: "q2", type: "essay_file" },
  ],
};

const mockFile = new File(["dummy"], "test.pdf", { type: "application/pdf" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue(mockIdentity);
  mockGetStore.mockResolvedValue(mockStore as unknown as BasiraStore);
  mockStore.getQuiz.mockResolvedValue(mockQuiz);
  mockStore.submitQuiz.mockResolvedValue("submission-1");
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockRm.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitQuizFormAction", () => {
  it("should persist submission and redirect on success", async () => {
    const formData = new FormData();
    formData.append("quizId", "quiz-1");
    formData.append("question_q1", "option-1");
    formData.append("question_q2", mockFile);

    await expect(submitQuizFormAction(formData)).rejects.toThrow("REDIRECT");
    expect(mockStore.submitQuiz).toHaveBeenCalled();
    expect(mockStore.attachSubmissionFile).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app/student");
    expect(mockRedirect).toHaveBeenCalledWith("/app/student/results/submission-1");
    expect(mockStore.voidSubmission).not.toHaveBeenCalled();
  });

  it("should rollback submission if file attachment fails", async () => {
    mockStore.attachSubmissionFile.mockRejectedValue(new Error("FILE_ERROR"));
    const formData = new FormData();
    formData.append("quizId", "quiz-1");
    formData.append("question_q2", mockFile);

    await expect(submitQuizFormAction(formData)).rejects.toThrow("REDIRECT");
    expect(mockStore.voidSubmission).toHaveBeenCalledWith(mockIdentity, "submission-1");
  });
});
