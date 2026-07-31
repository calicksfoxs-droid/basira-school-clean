import { describe, expect, it } from "vitest";
import { inferSubjectCoverKey, subjectCoverPath, SUBJECT_COVERS } from "@/lib/subject-covers";

describe("subject cover library", () => {
  it.each([
    ["الكيمياء العضوية", "chemistry"],
    ["كمياء", "chemistry"],
    ["فيزياء الصف الثالث", "physics"],
    ["الأحياء", "biology"],
    ["الرياضيات المتقدمة", "mathematics"],
    ["اللغة العربية", "arabic"],
    ["English language", "english"],
    ["التاريخ الإسلامي", "history"],
    ["جغرافيا الوطن العربي", "geography"],
    ["علوم الحاسب والبرمجة", "computer"],
    ["مهارات الحياة", "general"],
  ] as const)("infers %s as %s", (title, expected) => {
    expect(inferSubjectCoverKey(title)).toBe(expected);
  });

  it("prefers a teacher selection and resolves every cover to an optimized asset", () => {
    expect(subjectCoverPath({ title: "الكيمياء", coverKey: "history" })).toContain("subject-history-v1.webp");
    expect(SUBJECT_COVERS).toHaveLength(10);
    for (const cover of SUBJECT_COVERS) expect(cover.src).toMatch(/^\/images\/basira\/covers\/.*\.webp$/);
  });
});
