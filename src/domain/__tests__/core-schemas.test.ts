import { describe, expect, it } from "vitest";
import {
  createLearningSubjectSchema,
  enrollStudentSchema,
  updateSubjectBannerSchema,
  updateSubjectCoverSchema,
  userPreferencesSchema,
} from "@/domain/core-schemas";

describe("Basira core schemas", () => {
  it("normalizes optional subject text", () => {
    const gradeId = "10000000-0000-4000-8000-000000000001";
    expect(createLearningSubjectSchema.parse({ gradeId, title: "  الفيزياء  ", description: "" })).toEqual({ gradeId, title: "الفيزياء", description: undefined });
  });

  it("requires banner CTA label and path together and keeps paths internal", () => {
    const subjectId = "10000000-0000-4000-8000-000000000001";
    expect(updateSubjectBannerSchema.safeParse({ subjectId, ctaLabel: "ابدأ" }).success).toBe(false);
    expect(updateSubjectBannerSchema.safeParse({ subjectId, ctaLabel: "ابدأ", ctaPath: "https://example.com" }).success).toBe(false);
    expect(updateSubjectBannerSchema.safeParse({ subjectId, ctaLabel: "ابدأ", ctaPath: "/app/student/subjects/1" }).success).toBe(true);
  });

  it("accepts only built-in subject covers", () => {
    const subjectId = "10000000-0000-4000-8000-000000000001";
    expect(updateSubjectCoverSchema.safeParse({ subjectId, coverKey: "chemistry" }).success).toBe(true);
    expect(updateSubjectCoverSchema.safeParse({ subjectId, coverKey: "uploaded-file" }).success).toBe(false);
  });

  it("accepts only the independent enrollment-reference format", () => {
    const groupId = "10000000-0000-4000-8000-000000000001";
    expect(enrollStudentSchema.parse({ groupId, enrollmentReference: "bsr-s-abcd2345wxyz" }).enrollmentReference).toBe("BSR-S-ABCD2345WXYZ");
    expect(enrollStudentSchema.safeParse({ groupId, enrollmentReference: "BSR-STDN-DEMO2026" }).success).toBe(false);
  });

  it("keeps V1 preferences intentionally small", () => {
    expect(userPreferencesSchema.parse({ theme: "system", reducedMotion: false, locale: "ar" })).toEqual({ theme: "system", reducedMotion: false, locale: "ar" });
    expect(userPreferencesSchema.safeParse({ theme: "system", reducedMotion: false, locale: "en" }).success).toBe(false);
  });
});
