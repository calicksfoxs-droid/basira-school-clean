import type { LearningSubject, SubjectCoverKey } from "@/domain/core-models";

export type BasiraSubjectTheme = "core" | "chemistry" | "physics";

const chemistryWords = ["chemistry", "chemical", "كيمياء", "الكيمياء"];
const physicsWords = ["physics", "physical", "فيزياء", "الفيزياء"];

function includesAny(value: string, words: string[]) {
  const normalized = value.trim().toLowerCase();
  return words.some((word) => normalized.includes(word));
}

export function subjectThemeFromValues(title?: string, coverKey?: SubjectCoverKey): BasiraSubjectTheme {
  if (coverKey === "chemistry" || (title && includesAny(title, chemistryWords))) return "chemistry";
  if (coverKey === "physics" || (title && includesAny(title, physicsWords))) return "physics";
  return "core";
}

export function subjectTheme(subject?: Pick<LearningSubject, "title" | "coverKey">): BasiraSubjectTheme {
  return subjectThemeFromValues(subject?.title, subject?.coverKey);
}

export function teacherTheme(subjects: LearningSubject[]): BasiraSubjectTheme {
  const preferred = subjects.find((subject) => subjectTheme(subject) !== "core");
  return preferred ? subjectTheme(preferred) : "core";
}

export const subjectThemeMeta = {
  core: {
    label: "بصيرة",
    eyebrow: "BASIRA CORE",
    primary: "#3E51CC",
    secondary: "#147D79",
    accent: "#D99735",
    tint: "rgba(62,81,204,.08)",
  },
  chemistry: {
    label: "الكيمياء",
    eyebrow: "CHEMISTRY",
    primary: "#147D79",
    secondary: "#3C9D8A",
    accent: "#E07A5F",
    tint: "rgba(20,125,121,.08)",
  },
  physics: {
    label: "الفيزياء",
    eyebrow: "PHYSICS",
    primary: "#4C51BF",
    secondary: "#243D80",
    accent: "#C27803",
    tint: "rgba(76,81,191,.08)",
  },
} as const;
