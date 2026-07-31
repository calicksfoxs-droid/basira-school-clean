import { z } from "zod";
import { SUBJECT_COVER_KEYS } from "@/domain/core-models";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const internalPath = z.string().trim().max(300).refine((value) => value.startsWith("/app"), "يجب أن يكون الرابط داخلياً");

export const createLearningSubjectSchema = z.object({
  gradeId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  description: optionalText(500),
});

export const createCurriculumGradeSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: optionalText(300),
});

export const updateSubjectBannerSchema = z.object({
  subjectId: z.string().uuid(),
  title: optionalText(120),
  body: optionalText(500),
  ctaLabel: optionalText(60),
  ctaPath: internalPath.optional(),
}).refine((value) => Boolean(value.ctaLabel) === Boolean(value.ctaPath), {
  message: "نص الزر ورابطه مطلوبان معاً",
  path: ["ctaLabel"],
});

export const updateSubjectCoverSchema = z.object({
  subjectId: z.string().uuid(),
  coverKey: z.enum(SUBJECT_COVER_KEYS),
});

export const createSubjectGroupSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: optionalText(500),
});

export const createSubjectUnitSchema = z.object({
  subjectId: z.string().uuid(),
  termSegment: z.coerce.number().int().min(1).max(4),
  lessonCount: z.coerce.number().int().min(0).max(40).default(0),
  title: z.string().trim().min(2).max(120),
  description: optionalText(500),
});

export const removeUnitLessonSchema = z.object({
  lessonId: z.string().uuid(),
});

export const createUnitLessonSchema = z.object({
  unitId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  description: optionalText(500),
  structureMode: z.enum(["direct", "parts"]),
});

export const enrollStudentSchema = z.object({
  groupId: z.string().uuid(),
  enrollmentReference: z.string().trim().toUpperCase().regex(/^BSR-S-[A-Z2-9]{12}$/),
});

export const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(1).max(80),
  maintenanceMessage: optionalText(300),
});

export const userPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  reducedMotion: z.boolean(),
  locale: z.literal("ar"),
});
