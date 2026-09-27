import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(path.join(process.cwd(), "supabase/migrations/20260927154500_core1_repair_invariants.sql"), "utf8");
}

describe("Core 1.0 repair invariant contract", () => {
  it("adds measurable domain diagnostics without rewriting legacy relationships", async () => {
    const sql = await migration();
    for (const issue of [
      "active_group_without_subject_id",
      "active_membership_on_unlinked_group",
      "learning_subject_without_units",
      "published_subject_without_active_group",
      "learning_lesson_without_unit",
      "subject_grade_owner_mismatch",
      "group_subject_owner_mismatch",
    ]) expect(sql).toContain(issue);

    expect(sql).toContain("core1_repair_diagnostics_v1");
    expect(sql).toContain("grant execute on function public.core1_repair_diagnostics_v1() to service_role");
    expect(sql).not.toMatch(/update\s+public\.groups[\s\S]{0,200}set\s+subject_id/i);
  });

  it("provides a student subject projection that remains under RLS", async () => {
    const sql = await migration();
    expect(sql).toContain("list_my_learning_subjects_v1");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("public.current_app_role() = 'student'");
    expect(sql).toContain("public.session_is_current()");
    expect(sql).toContain("grant execute on function public.list_my_learning_subjects_v1() to authenticated");
  });

  it("makes authoring creation atomic and serializes order allocation on parent rows", async () => {
    const sql = await migration();
    for (const rpc of [
      "create_curriculum_grade_v2",
      "create_learning_subject_v2",
      "create_subject_unit_v2",
      "create_unit_lesson_v2",
    ]) expect(sql).toContain(rpc);

    expect(sql).toContain("for update");
    expect(sql).toContain("subjects_grade_display_order_v2_unique");
    expect(sql).toContain("for v_term in 1..4 loop");
    expect(sql).toContain("for v_unit in 1..2 loop");
  });

  it("enforces the frozen objective-only assessment boundary in the database", async () => {
    const sql = await migration();
    expect(sql).toContain("enforce_core1_objective_question_v1");
    expect(sql).toContain("new.type not in ('mcq', 'true_false')");
    expect(sql).toContain("Core 1.0 supports MCQ and True/False only");
    expect(sql).toContain("before insert or update of quiz_id, type on public.quiz_questions");
  });
});
