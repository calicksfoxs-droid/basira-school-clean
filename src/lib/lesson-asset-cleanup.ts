import "server-only";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { demoUploadDir } from "@/lib/demo/demo-db";
import { deleteR2Object } from "@/lib/r2-storage";

type CleanupTask = {
  id: string;
  asset_id: string;
  storage_provider: "demo" | "supabase" | "r2";
  bucket: "lesson-videos" | "lesson-handouts";
  storage_path: string;
  attempts: number;
};

async function markCleanup(id: string, success: boolean, error?: unknown) {
  const admin = createAdminSupabaseClient();
  const { error: rpcError } = await admin.rpc("complete_lesson_asset_cleanup_v1", {
    p_id: id,
    p_success: success,
    p_error: success ? null : String(error instanceof Error ? error.message : error ?? "cleanup failed"),
  });
  if (rpcError) console.error("lesson_asset_cleanup_mark_failed", id, rpcError.message);
}

async function deleteTaskObject(task: CleanupTask) {
  if (task.storage_provider === "r2") {
    await deleteR2Object(task.storage_path);
    return;
  }

  if (task.storage_provider === "supabase") {
    const admin = createAdminSupabaseClient();
    const { error } = await admin.storage.from(task.bucket).remove([task.storage_path]);
    if (error) throw error;
    return;
  }

  const root = path.resolve(demoUploadDir());
  const target = path.resolve(root, task.storage_path);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid demo cleanup path");
  }
  await rm(target, { force: true });
}

/**
 * Best-effort durable cleanup. A failed external deletion stays pending in the
 * database and is retried by a later successful finalize instead of being lost.
 */
export async function drainPendingLessonAssetCleanup(limit = 10) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("list_pending_lesson_asset_cleanup_v1", {
    p_limit: Math.max(1, Math.min(limit, 100)),
  });
  if (error) {
    console.error("lesson_asset_cleanup_list_failed", error.message);
    return;
  }

  for (const row of (data ?? []) as CleanupTask[]) {
    try {
      await deleteTaskObject(row);
      await markCleanup(row.id, true);
    } catch (cleanupError) {
      console.error("lesson_asset_cleanup_failed", row.id, cleanupError instanceof Error ? cleanupError.message : cleanupError);
      await markCleanup(row.id, false, cleanupError);
    }
  }
}

/** Never delete an uploaded object from an error path if a ready DB asset uses it. */
export async function isReadyLessonAssetPathReferenced(storagePath: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lesson_assets")
    .select("id")
    .eq("storage_path", storagePath)
    .eq("state", "ready")
    .maybeSingle();
  if (error) {
    console.error("lesson_asset_reference_check_failed", error.message);
    // Fail closed: if we cannot prove it is unreferenced, do not delete it.
    return true;
  }
  return Boolean(data);
}
