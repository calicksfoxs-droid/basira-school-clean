import { z } from "zod";

export const accessCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^BSR-[A-Z0-9]{4}-[A-Z0-9]{8}$/, "صيغة رمز الدخول غير صحيحة");

export const nameSchema = z.string().trim().min(2, "الاسم قصير").max(80, "الاسم طويل");
export const titleSchema = z.string().trim().min(2, "العنوان قصير").max(120, "العنوان طويل");
export const optionalTextSchema = z.string().trim().max(500, "النص طويل").optional().or(z.literal(""));

export const createGroupSchema = z.object({
  name: titleSchema,
  description: optionalTextSchema,
  ownerTeacherId: z.string().uuid().optional(),
});

export const createUserSchema = z.object({
  displayName: nameSchema,
  groupId: z.string().uuid().optional(),
  contactNumber: z.string().trim().max(40).optional(),
});

export const createSubjectSchema = z.object({
  groupId: z.string().uuid(),
  title: titleSchema,
  description: optionalTextSchema,
});

export const createLessonSchema = z.object({
  subjectId: z.string().uuid(),
  title: titleSchema,
  description: optionalTextSchema,
  structureMode: z.enum(["direct", "parts"]),
});

export const announcementSchema = z.object({
  targetType: z.enum(["global", "group"]),
  groupId: z.string().uuid().optional(),
  title: titleSchema,
  body: z.string().trim().min(2).max(220),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaPath: z.string().trim().regex(/^\/app(?:\/.*)?$/, "الرابط يجب أن يكون داخليًا").optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (value.targetType === "group" && !value.groupId) {
    ctx.addIssue({ code: "custom", path: ["groupId"], message: "اختر المجموعة" });
  }
});

export const quizQuestionSchema = z.object({
  type: z.enum(["mcq", "true_false", "essay_text", "essay_file"]),
  prompt: z.string().trim().min(2).max(500),
  points: z.coerce.number().positive().max(100),
  options: z.array(z.object({ text: z.string().trim().min(1).max(200), isCorrect: z.boolean() })).optional(),
  correctBoolean: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.type === "mcq") {
    if (!value.options || value.options.length < 2 || value.options.filter((o) => o.isCorrect).length !== 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "السؤال الاختياري يحتاج خيارين وإجابة صحيحة واحدة" });
    }
  }
  if (value.type === "true_false" && typeof value.correctBoolean !== "boolean") {
    ctx.addIssue({ code: "custom", path: ["correctBoolean"], message: "حدد الإجابة الصحيحة" });
  }
});

export const createLessonPartSchema = z.object({
  lessonId: z.string().uuid(),
  title: titleSchema,
  description: optionalTextSchema,
});

export const createQuizSchema = z.object({
  lessonId: z.string().uuid().optional(),
  lessonPartId: z.string().uuid().optional(),
  title: titleSchema,
  instructions: optionalTextSchema,
  questions: z.array(quizQuestionSchema).min(1, "أضف سؤالًا واحدًا على الأقل"),
}).superRefine((value, ctx) => {
  if (Number(Boolean(value.lessonId)) + Number(Boolean(value.lessonPartId)) !== 1) {
    ctx.addIssue({ code: "custom", path: ["lessonId"], message: "يجب ربط الاختبار بالدرس أو بجزء واحد" });
  }
});

export const manualGradeSchema = z.object({
  submissionId: z.string().uuid(),
  scores: z.record(z.string().uuid(), z.coerce.number().min(0)),
  feedback: z.record(z.string().uuid(), z.string().trim().max(500)),
  release: z.boolean().default(false),
});
