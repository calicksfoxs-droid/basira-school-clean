import { SUBJECT_COVER_KEYS, type LearningSubject, type SubjectCoverKey } from "@/domain/core-models";

export { SUBJECT_COVER_KEYS };
export type { SubjectCoverKey };

export interface SubjectCover {
  key: SubjectCoverKey;
  label: string;
  description: string;
  src: string;
}

export const SUBJECT_COVERS: readonly SubjectCover[] = [
  { key: "general", label: "تعليم عام", description: "كتاب ورحلة معرفية", src: "/images/basira/covers/subject-general-v1.webp" },
  { key: "arabic", label: "اللغة العربية", description: "كتاب وحبر وعمارة عربية", src: "/images/basira/covers/subject-arabic-v1.webp" },
  { key: "english", label: "اللغة الإنجليزية", description: "لغة وتواصل عالمي", src: "/images/basira/covers/subject-english-v1.webp" },
  { key: "mathematics", label: "الرياضيات", description: "هندسة ومنحنيات وأرقام", src: "/images/basira/covers/subject-mathematics-v1.webp" },
  { key: "physics", label: "الفيزياء", description: "ضوء وحركة وموجات", src: "/images/basira/covers/subject-physics-v1.webp" },
  { key: "chemistry", label: "الكيمياء", description: "مختبر وجزيئات وتفاعلات", src: "/images/basira/covers/subject-chemistry-v1.webp" },
  { key: "biology", label: "الأحياء", description: "خلية وDNA ونباتات", src: "/images/basira/covers/subject-biology-v1.webp" },
  { key: "history", label: "التاريخ", description: "حضارات وآثار وزمن", src: "/images/basira/covers/subject-history-v1.webp" },
  { key: "geography", label: "الجغرافيا", description: "كرة أرضية وخرائط وتضاريس", src: "/images/basira/covers/subject-geography-v1.webp" },
  { key: "computer", label: "الحاسب والتقنية", description: "دوائر ومعالج وشبكات", src: "/images/basira/covers/subject-computer-v1.webp" },
] as const;

const PATH_BY_KEY = new Map(SUBJECT_COVERS.map((cover) => [cover.key, cover.src]));

export function isSubjectCoverKey(value: unknown): value is SubjectCoverKey {
  return typeof value === "string" && SUBJECT_COVER_KEYS.includes(value as SubjectCoverKey);
}

export function inferSubjectCoverKey(title: string): SubjectCoverKey {
  const value = title.trim().toLowerCase();
  if (/كيمياء|كيميا|chem/.test(value)) return "chemistry";
  if (/فيزياء|طبيعة|physics/.test(value)) return "physics";
  if (/أحياء|احياء|بيولوج|biology/.test(value)) return "biology";
  if (/رياضيات|رياضة|حساب|جبر|هندس|math/.test(value)) return "mathematics";
  if (/تاريخ|حضار|history/.test(value)) return "history";
  if (/جغراف|خريط|geograph/.test(value)) return "geography";
  if (/حاسب|حاسوب|كمبيوتر|برمج|تقني|computer|coding/.test(value)) return "computer";
  if (/إنجليز|انجليز|english|لغة.*أجنب|لغة.*اجنب/.test(value)) return "english";
  if (/عرب|نحو|بلاغ|arabic/.test(value)) return "arabic";
  return "general";
}

export function subjectCoverKey(subject: Pick<LearningSubject, "title" | "coverKey">): SubjectCoverKey {
  return isSubjectCoverKey(subject.coverKey) ? subject.coverKey : inferSubjectCoverKey(subject.title);
}

export function subjectCoverPath(subject: Pick<LearningSubject, "title" | "coverKey">): string {
  return PATH_BY_KEY.get(subjectCoverKey(subject)) ?? PATH_BY_KEY.get("general")!;
}
