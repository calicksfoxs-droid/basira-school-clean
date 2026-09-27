import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

describe("lesson asset finalization repair", () => {
  it("makes finalization idempotent before replacing the current asset", async () => {
    const sql = await read("supabase/migrations/20260927173000_idempotent_asset_finalize_cleanup.sql");
    expect(sql).toContain("finalize_lesson_asset_v2");
    expect(sql).toContain("where a.storage_path=p_storage_path");
    expect(sql).toContain("if v_existing.state='ready'");
    expect(sql).toContain("return v_existing");
    expect(sql.indexOf("where a.storage_path=p_storage_path")).toBeLessThan(
      sql.indexOf("update public.lesson_assets\n  set state='removed'"),
    );
  });

  it("persists cleanup work when an active object is superseded", async () => {
    const sql = await read("supabase/migrations/20260927173000_idempotent_asset_finalize_cleanup.sql");
    expect(sql).toContain("private.lesson_asset_cleanup_queue_v1");
    expect(sql).toContain("enqueue_removed_lesson_asset_cleanup_v1");
    expect(sql).toContain("after update of state on public.lesson_assets");
    expect(sql).toContain("list_pending_lesson_asset_cleanup_v1");
    expect(sql).toContain("complete_lesson_asset_cleanup_v1");
  });

  it("never deletes an uploaded object from an error path if DB still references it", async () => {
    const [route, cleanup] = await Promise.all([
      read("src/app/api/uploads/finalize/route.ts"),
      read("src/lib/lesson-asset-cleanup.ts"),
    ]);
    expect(route).toContain("isReadyLessonAssetPathReferenced(payload.objectPath)");
    expect(route).toContain("if (!referenced) await cleanup()");
    expect(cleanup).toContain("Fail closed");
    expect(cleanup).toContain('.eq("state", "ready")');
  });

  it("records the storage provider in the database finalization call", async () => {
    const store = await read("src/lib/data/repaired-supabase-store.ts");
    expect(store).toContain('rpc("finalize_lesson_asset_v2"');
    expect(store).toContain("p_storage_provider: storageProvider");
    expect(store).not.toContain('rpc("finalize_lesson_asset_phase13a"');
  });
});
