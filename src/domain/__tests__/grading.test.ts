import { describe, expect, it } from "vitest";
import { gradeObjectiveAnswer, hasManualQuestions, totalPoints } from "../grading";
import type { Question } from "../models";

const questions: Question[] = [
  { id: "1", quizId: "q", type: "mcq", prompt: "اختر", points: 2, displayOrder: 1, required: true, options: [
    { id: "a", text: "أ", displayOrder: 1, isCorrect: false },
    { id: "b", text: "ب", displayOrder: 2, isCorrect: true },
  ] },
  { id: "2", quizId: "q", type: "true_false", prompt: "صح؟", points: 3, displayOrder: 2, required: true, correctBoolean: true },
  { id: "3", quizId: "q", type: "essay_text", prompt: "اشرح", points: 5, displayOrder: 3, required: true },
];

describe("grading", () => {
  it("grades MCQ deterministically", () => {
    expect(gradeObjectiveAnswer(questions[0], { selectedOptionId: "b" })).toBe(2);
    expect(gradeObjectiveAnswer(questions[0], { selectedOptionId: "a" })).toBe(0);
  });
  it("grades true/false deterministically", () => {
    expect(gradeObjectiveAnswer(questions[1], { booleanValue: true })).toBe(3);
    expect(gradeObjectiveAnswer(questions[1], { booleanValue: false })).toBe(0);
  });
  it("detects manual questions and totals points", () => {
    expect(hasManualQuestions(questions)).toBe(true);
    expect(totalPoints(questions)).toBe(10);
  });
});
