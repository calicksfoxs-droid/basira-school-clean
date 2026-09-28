import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(
    path.join(process.cwd(), "supabase/migrations/20260928145500_teacher_core_write_boundary.sql"),
    "utf8",
  );
}

describe("teacher Core write boundary", () => {
  it("replaces teacher ALL policies with SELECT-only ownership policies", async () => {
    const sql = await migration();
    for (const legacy of [
      "curriculum_grades_teacher_owned_v1",
      "groups_teacher_all_own",
      "subjects_teacher_all",
      "subjects_teacher_owned_v1",
      "subject_units_teacher_owned_v1",
      "lessons_teacher_all",
      "lessons_teacher_owned_v1",
    ]) expect(sql).toContain(`drop policy if exists ${legacy}`);

    expect(sql.match(/for select/g)?.length).toBe(5);
    expect(sql).toContain("public.session_is_current()");
    expect(sql).toContain("public.current_app_role()='teacher'");
    expect(sql).not.toMatch(/for\s+(insert|update|delete|all)\s+to\s+authenticated/i);
  });

  it("keeps ownership scoped to the authenticated teacher", async () => {
    const sql = await migration();
    expect(sql).toContain("owner_teacher_id=auth.uid()");
    expect(sql).toContain("s.owner_teacher_id=auth.uid()");
  });
});
