import type { Answer, Question } from "./models";

export function gradeObjectiveAnswer(question: Question, answer: Pick<Answer, "selectedOptionId" | "booleanValue">): number {
  if (question.type === "mcq") {
    const correct = question.options?.find((option) => option.isCorrect);
    return correct && answer.selectedOptionId === correct.id ? question.points : 0;
  }
  if (question.type === "true_false") {
    return answer.booleanValue === question.correctBoolean ? question.points : 0;
  }
  return 0;
}

export function hasManualQuestions(questions: Question[]): boolean {
  return questions.some((question) => question.type === "essay_text" || question.type === "essay_file");
}

export function totalPoints(questions: Question[]): number {
  return questions.reduce((sum, question) => sum + question.points, 0);
}
