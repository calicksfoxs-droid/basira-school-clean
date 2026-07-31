import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(path.join(process.cwd(), "supabase/migrations/006_grade_curriculum_hierarchy.sql"), "utf8");
}

describe("grade curriculum hierarchy migration contract", () => {
  it("adds teacher-owned grades without deleting the existing hierarchy", async () => {
    const sql = await migration();
    expect(sql).toContain("create table if not exists public.curriculum_grades");
    expect(sql).toContain("owner_teacher_id uuid not null references public.profiles(id) on delete restrict");
    expect(sql).toContain("description text check (char_length(description) <= 300)");
    expect(sql).not.toMatch(/drop\s+table/i);
  });

  it("backfills every existing subject before enforcing grade ownership", async () => {
    const sql = await migration();
    expect(sql).toContain("'صف غير مصنف'");
    expect(sql).toContain("update public.subjects s");
    expect(sql).toContain("alter table public.subjects alter column grade_id set not null");
  });

  it("supports four segments and independent unit ordering in each segment", async () => {
    const sql = await migration();
    expect(sql).toContain("term_segment smallint not null default 1");
    expect(sql).toContain("term_segment between 1 and 4");
    expect(sql).toContain("unique(subject_id,term_segment,display_order)");
    expect(sql).toContain("cover_path text");
  });

  it("lets students see only grades containing a subject they can access", async () => {
    const sql = await migration();
    expect(sql).toContain("curriculum_grades_student_enrolled_v1");
    expect(sql).toContain("public.student_in_learning_subject_v1(s.id)");
  });
});
