import { describe, expect, it } from "vitest";
import { createQuizSchema } from "@/domain/schemas";

const lessonId = "30000000-0000-4000-8000-000000000001";

describe("Core 1.0 quiz schema", () => {
  it("accepts MCQ and True/False only", () => {
    expect(createQuizSchema.safeParse({
      lessonId,
      title: "اختبار موضوعي",
      questions: [
        {
          type: "mcq",
          prompt: "اختر الإجابة",
          points: 1,
          options: [
            { text: "أ", isCorrect: true },
            { text: "ب", isCorrect: false },
          ],
        },
        {
          type: "true_false",
          prompt: "العبارة صحيحة",
          points: 1,
          correctBoolean: true,
        },
      ],
    }).success).toBe(true);
  });

  it("rejects crafted essay questions at the server schema boundary", () => {
    for (const type of ["essay_text", "essay_file"]) {
      expect(createQuizSchema.safeParse({
        lessonId,
        title: "اختبار غير مدعوم",
        questions: [{ type, prompt: "سؤال مقالي", points: 1 }],
      }).success).toBe(false);
    }
  });
});
