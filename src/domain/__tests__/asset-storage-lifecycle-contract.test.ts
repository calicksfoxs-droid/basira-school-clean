import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function read(relative: string) {
  return readFile(path.join(process.cwd(), relative), "utf8");
}

describe("asset storage lifecycle repair", () => {
  it("persists provider and upload intent metadata before finalization", async () => {
    const sql = await read("supabase/migrations/20260928135000_asset_storage_lifecycle.sql");
    for (const expected of [
      "storage_provider",
      "private.asset_upload_intents_v1",
      "lesson_id uuid",
      "lesson_part_id uuid",
      "mime_type text",
      "size_bytes bigint",
      "register_asset_upload_intent_v1",
      "finalize_lesson_asset_v2",
    ]) expect(sql).toContain(expected);
  });

  it("makes finalize retries idempotent and replacement cleanup durable", async () => {
    const sql = await read("supabase/migrations/20260928135000_asset_storage_lifecycle.sql");
    expect(sql).toContain("v_intent.state='finalized'");
    expect(sql).toContain("finalized_asset_id");
    expect(sql).toContain("asset_storage_cleanup_jobs_v1");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("claim_stale_asset_upload_intents_v1");
    expect(sql).not.toMatch(/delete\s+from\s+public\.lesson_assets/i);
  });

  it("keeps legacy RPC shutdown as an explicit post-deploy phase", async () => {
    const sql = await read("supabase/migrations/20260928141000_disable_legacy_asset_finalize.sql");
    expect(sql).toContain("revoke execute on function public.finalize_lesson_asset_phase13a");
    expect(sql).toContain("from authenticated");
    expect(sql).not.toMatch(/drop\s+function/i);
  });

  it("registers intents in authorize and consumes lifecycle v2 in finalize", async () => {
    const [authorize, finalize, store] = await Promise.all([
      read("src/app/api/uploads/authorize/route.ts"),
      read("src/app/api/uploads/finalize/route.ts"),
      read("src/lib/data/repaired-supabase-store.ts"),
    ]);
    expect(authorize).toContain("register_asset_upload_intent_v1");
    expect(authorize).toContain("p_mime_type");
    expect(authorize).toContain("p_size_bytes");
    expect(finalize).toContain("uploadId: payload.uploadId");
    expect(finalize).toContain("drainAssetStorageGarbage");
    expect(store).toContain("finalize_lesson_asset_v2");
  });
});
