import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

describe("teacher finance notes are server-backed and private", () => {
  it("stores amount and payment notes in the teacher-private database record through a teacher-only server boundary", async () => {
    const [serverLib, action] = await Promise.all([
      read("src/lib/teacher-private-records.ts"),
      read("src/actions/teacher-private-records.ts"),
    ]);

    expect(serverLib).toContain("teacher_student_private_records");
    expect(serverLib).toContain("amount_note");
    expect(serverLib).toContain("payment_note");
    expect(serverLib).toContain('identity.role === "teacher"');
    expect(serverLib).toContain("owner_teacher_id");
    expect(serverLib).toContain('membership.status === "active"');
    expect(action).toContain('requireRole("teacher")');
    expect(action).toContain("saveTeacherFinanceRecord");
  });

  it("uses the canonical teacher students workspace and has no browser-local persistence", async () => {
    const [page, editor] = await Promise.all([
      read("src/app/app/teacher/students/page.tsx"),
      read("src/components/students/teacher-finance-note.tsx"),
    ]);

    expect(page).toContain("listTeacherPrivateEnrollmentRecords");
    expect(page).toContain("TeacherFinanceNoteEditor");
    expect(editor).toContain("saveTeacherFinanceRecordAction");
    expect(editor).not.toContain("localStorage");
    expect(editor).not.toContain("teacher-finance-local");
    expect(editor).not.toContain('"use client"');

    await expect(access(path.join(root, "src/lib/teacher-finance-local.ts"))).rejects.toBeTruthy();
  });

  it("does not expose teacher-private finance UI from student or admin pages", async () => {
    const studentPages = [
      "src/app/app/student/page.tsx",
      "src/app/app/student/results/page.tsx",
      "src/app/app/student/subjects/page.tsx",
    ];
    const adminPages = [
      "src/app/app/admin/page.tsx",
      "src/app/app/admin/students/page.tsx",
    ];

    for (const file of [...studentPages, ...adminPages]) {
      const source = await read(file);
      expect(source).not.toContain("TeacherFinanceNoteEditor");
      expect(source).not.toContain("listTeacherPrivateEnrollmentRecords");
      expect(source).not.toContain("teacher-private-records");
    }
  });
});
