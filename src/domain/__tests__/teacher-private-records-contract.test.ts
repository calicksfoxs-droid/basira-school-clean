import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(
    path.join(process.cwd(), "supabase/migrations/20260928142000_teacher_private_records_rls.sql"),
    "utf8",
  );
}

describe("teacher private record boundary", () => {
  it("removes the legacy admin projection and keeps owner-only teacher RLS", async () => {
    const sql = await migration();
    expect(sql).toContain("drop policy if exists private_admin_all");
    expect(sql).toContain("to authenticated");
    expect(sql).toContain("public.session_is_current()");
    expect(sql).toContain("public.current_app_role()='teacher'");
    expect(sql).toContain("teacher_id=auth.uid()");
    expect(sql).toContain("public.owns_group(group_id)");
    expect(sql).not.toMatch(/delete\s+from\s+public\.teacher_student_private_records/i);
  });
});
