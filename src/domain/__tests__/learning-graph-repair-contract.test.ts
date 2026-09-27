import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function migration() {
  return readFile(path.join(process.cwd(), "supabase/migrations/20260927160000_repair_unlinked_learning_graph.sql"), "utf8");
}

describe("deterministic Learning Core graph repair", () => {
  it("contains no generated production IDs and never auto-publishes content", async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(sql).not.toMatch(/set\s+status\s*=\s*'published'/i);
    expect(sql).not.toMatch(/values\s*\([^)]*published/i);
  });

  it("only links a group when both sides of the mapping are unique", async () => {
    const sql = await migration();
    expect(sql).toContain("having count(*) = 1");
    expect(sql).toContain("Ambiguous legacy group to Learning Core subject mapping");
    expect(sql).toContain("exists (\n        select 1 from public.group_memberships");
    expect(sql).toContain("and m.status = 'active'");
  });

  it("preserves runtime immutability by restoring the ownership trigger", async () => {
    const sql = await migration();
    expect(sql).toContain("drop trigger if exists enforce_subject_group_owner_v1 on public.groups");
    expect(sql).toContain("create trigger enforce_subject_group_owner_v1");
    expect(sql).toContain("execute function public.enforce_subject_group_owner_v1()");
  });

  it("backfills the eight default units only for completely empty root subjects", async () => {
    const sql = await migration();
    expect(sql).toContain("values (1), (2), (3), (4)");
    expect(sql).toContain("values (1, 'الوحدة الأولى'), (2, 'الوحدة الثانية')");
    expect(sql).toContain("not exists (\n    select 1 from public.subject_units existing");
  });
});
