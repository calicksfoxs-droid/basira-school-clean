import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(
    path.join(process.cwd(), "supabase/migrations/20260928151500_teacher_sensitive_write_boundary.sql"),
    "utf8",
  );
}

describe("teacher sensitive write boundary", () => {
  it("removes direct teacher ALL policies from private records and answer keys", async () => {
    const sql = await migration();
    expect(sql).toContain("drop policy if exists private_teacher_all_own_v2");
    expect(sql).toContain("drop policy if exists question_answers_teacher");
    expect(sql).toContain("drop policy if exists option_answers_teacher");
    expect(sql.match(/for select to authenticated/g)?.length).toBe(3);
    expect(sql).not.toMatch(/for\s+(all|insert|update|delete)\s+to\s+authenticated/i);
  });

  it("keeps private data and answer keys scoped to the owning teacher", async () => {
    const sql = await migration();
    expect(sql).toContain("teacher_id=(select auth.uid())");
    expect(sql).toContain("public.owns_group(group_id)");
    expect(sql).toContain("public.teacher_owns_quiz(q.quiz_id)");
  });
});
