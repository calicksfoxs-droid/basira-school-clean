import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

describe("student identity and Learning Core enrollment split", () => {
  it("keeps standalone student provisioning Admin-only and membership-free", async () => {
    const sql = await read("supabase/migrations/20260927164500_student_identity_enrollment_split.sql");
    expect(sql).toContain("Only active Admin can create Student identity");
    expect(sql).toContain("provision_student_identity_v2");

    const provisionBody = sql.split("create or replace function public.provision_student_identity_v2")[1]
      ?.split("revoke all on function public.prepare_student_identity_creation_v2")[0] ?? "";
    expect(provisionBody).toContain("insert into public.profiles");
    expect(provisionBody).toContain("insert into public.access_credentials");
    expect(provisionBody).not.toContain("insert into public.group_memberships");
    expect(provisionBody).not.toContain("insert into public.teacher_student_private_records");
  });

  it("routes Admin to identity creation and Teacher to reference enrollment", async () => {
    const [adminPage, teacherPage, groupView, dataIndex] = await Promise.all([
      read("src/app/app/admin/students/page.tsx"),
      read("src/app/app/teacher/students/page.tsx"),
      read("src/components/groups/group-details-view.tsx"),
      read("src/lib/data/index.ts"),
    ]);

    expect(adminPage).toContain("CreateStudentIdentityForm");
    expect(adminPage).not.toContain("CreateStudentForm");
    expect(teacherPage).toContain("enrollExistingStudentFormAction");
    expect(teacherPage).toContain('name="enrollmentReference"');
    expect(teacherPage).not.toContain("CreateStudentForm");
    expect(groupView).not.toContain("CreateStudentForm");
    expect(dataIndex).toContain("RepairedSupabaseStore");
    expect(dataIndex).toContain("RepairedDemoStore");
  });

  it("enforces the split again at the store boundary", async () => {
    const [supabaseStore, demoStore] = await Promise.all([
      read("src/lib/data/repaired-supabase-store.ts"),
      read("src/lib/data/repaired-demo-store.ts"),
    ]);
    for (const source of [supabaseStore, demoStore]) {
      expect(source).toContain('identity.role === "admin"');
      expect(source).toContain("!input.groupId");
      expect(source).toContain("إنشاء الحساب منفصل عن التسجيل في المجموعات");
    }
  });
});
