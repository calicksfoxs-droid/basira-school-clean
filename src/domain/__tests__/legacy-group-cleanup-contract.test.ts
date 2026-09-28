import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(
    path.join(process.cwd(), "supabase/migrations/20260928133000_archive_empty_legacy_groups.sql"),
    "utf8",
  );
}

describe("legacy group cleanup contract", () => {
  it("archives only active unlinked groups with no dependencies", async () => {
    const sql = await migration();
    expect(sql).toContain("set status = 'archived'");
    expect(sql).toContain("g.status = 'active'");
    expect(sql).toContain("g.subject_id is null");
    expect(sql).toContain("public.group_memberships");
    expect(sql).toContain("public.subjects");
    expect(sql).toContain("public.teacher_student_private_records");
    expect(sql).toContain("public.announcements");
  });

  it("never deletes groups or hard-codes production ids", async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/delete\s+from\s+public\.groups/i);
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    expect(sql).toContain("Empty active legacy groups remain after cleanup");
  });
});
