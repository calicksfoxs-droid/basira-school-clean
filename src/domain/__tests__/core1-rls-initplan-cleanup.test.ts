import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(
    path.join(process.cwd(), "supabase/migrations/20260928152500_core1_rls_initplan_cleanup.sql"),
    "utf8",
  );
}

describe("Core 1 RLS init-plan cleanup", () => {
  it("covers the remaining unindexed foreign keys", async () => {
    const sql = await migration();
    for (const indexName of [
      "access_credentials_issued_by_v1_idx",
      "groups_created_by_v1_idx",
      "platform_settings_updated_by_v1_idx",
      "profiles_created_by_v1_idx",
    ]) expect(sql).toContain(indexName);
  });

  it("caches auth.uid and scopes user-facing policies to authenticated", async () => {
    const sql = await migration();
    expect(sql.match(/\(select auth\.uid\(\)\)/g)?.length).toBeGreaterThanOrEqual(9);
    expect(sql.match(/to authenticated/g)?.length).toBe(7);
    expect(sql).toContain("public.session_is_current()");
    expect(sql).toContain("public.owns_group(group_id)");
  });
});
