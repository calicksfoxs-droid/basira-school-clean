import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(
    path.join(process.cwd(), "supabase/migrations/20260928150500_core1_performance_hardening.sql"),
    "utf8",
  );
}

describe("Core 1 performance hardening", () => {
  it("covers recoverable-storage and hot public foreign keys", async () => {
    const sql = await migration();
    for (const indexName of [
      "asset_cleanup_jobs_asset_v1_idx",
      "asset_upload_intents_user_v1_idx",
      "asset_upload_intents_lesson_v1_idx",
      "asset_upload_intents_part_v1_idx",
      "asset_upload_intents_final_asset_v1_idx",
      "learning_progress_lesson_v1_idx",
      "lesson_assets_owner_student_v1_idx",
      "lesson_assets_submission_v1_idx",
      "quiz_answers_question_v1_idx",
      "quiz_answers_selected_option_v1_idx",
      "quiz_answers_file_asset_v1_idx",
      "quiz_option_answers_option_v1_idx",
      "private_records_group_v1_idx",
      "private_records_student_v1_idx",
    ]) expect(sql).toContain(indexName);
  });

  it("keeps teacher policy semantics while caching auth.uid per statement", async () => {
    const sql = await migration();
    expect(sql.match(/\(select auth\.uid\(\)\)/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).toContain("public.session_is_current()");
    expect(sql).toContain("public.current_app_role()='teacher'");
    expect(sql).toContain("public.owns_group(group_id)");
  });
});
