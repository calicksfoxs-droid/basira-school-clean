import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(path.join(process.cwd(), "supabase/migrations/002_independent_learning_core.sql"), "utf8");
}

describe("independent learning core migration contract", () => {
  it("contains the new hierarchy, banner, settings, and one-time reference storage", async () => {
    const sql = await migration();
    for (const required of [
      "owner_teacher_id", "groups add column if not exists subject_id", "subject_units",
      "banner_title", "unit_id", "student_enrollment_references", "fingerprint",
      "platform_settings", "user_preferences",
    ]) expect(sql).toContain(required);
    expect(sql).not.toMatch(/reference_code|full_reference|login_secret/i);
  });

  it("implements teacher-driven enrollment and active-membership visibility", async () => {
    const sql = await migration();
    expect(sql).toContain("enroll_student_by_reference_v1(p_group_id uuid,p_reference text)");
    expect(sql).toContain("public.current_app_role()<>'teacher'");
    expect(sql).toContain("m.status='active'");
    expect(sql).toContain("g.subject_id=p_subject_id");
    expect(sql).toContain("raise exception 'Enrollment failed'");
  });

  it("does not destructively map legacy groups to an arbitrary subject", async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/update\s+public\.groups[\s\S]{0,200}set\s+subject_id/i);
    expect(sql).toContain("Legacy groups keep subject_id NULL");
    expect(sql).not.toContain("set status='published' where status='active'");
    expect(sql).toContain("s.status in ('active','published')");
  });
});
