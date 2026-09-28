import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deleteR2Object } from "@/lib/r2-storage";

type CleanupRow = {
  id: string;
  storage_provider: "supabase" | "r2";
  kind: "video" | "handout";
  storage_path?: string;
  object_path?: string;
};

function bucketFor(kind: "video" | "handout") {
  return kind === "video" ? "lesson-videos" : "lesson-handouts";
}

async function deleteStoredObject(row: CleanupRow) {
  const objectPath = row.storage_path ?? row.object_path;
  if (!objectPath) throw new Error("Missing storage path");

  if (row.storage_provider === "r2") {
    if (row.kind !== "video") throw new Error("R2 cleanup is only valid for lesson videos");
    await deleteR2Object(objectPath);
    return;
  }

  const { error } = await createAdminSupabaseClient()
    .storage
    .from(bucketFor(row.kind))
    .remove([objectPath]);
  if (error) throw error;
}

export async function drainAssetStorageGarbage(limit = 20) {
  const admin = createAdminSupabaseClient();
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit) || 20));

  const cleanupResult = await admin.rpc("claim_asset_storage_cleanup_jobs_v1", {
    p_limit: boundedLimit,
  });
  if (cleanupResult.error) throw cleanupResult.error;

  for (const raw of (cleanupResult.data ?? []) as CleanupRow[]) {
    try {
      await deleteStoredObject(raw);
      const { error } = await admin.rpc("finish_asset_storage_cleanup_job_v1", {
        p_id: raw.id,
        p_success: true,
        p_error: null,
      });
      if (error) throw error;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const { error: finishError } = await admin.rpc("finish_asset_storage_cleanup_job_v1", {
        p_id: raw.id,
        p_success: false,
        p_error: message,
      });
      if (finishError) console.error("asset_cleanup_state_failed", finishError.message);
      console.error("asset_cleanup_failed", raw.id, message);
    }
  }

  const staleResult = await admin.rpc("claim_stale_asset_upload_intents_v1", {
    p_limit: boundedLimit,
  });
  if (staleResult.error) throw staleResult.error;

  for (const raw of (staleResult.data ?? []) as CleanupRow[]) {
    let success = false;
    try {
      await deleteStoredObject(raw);
      success = true;
    } catch (error) {
      console.error("stale_upload_cleanup_failed", raw.id, error instanceof Error ? error.message : String(error));
    }

    const { error } = await admin.rpc("finish_stale_asset_upload_intent_v1", {
      p_id: raw.id,
      p_success: success,
    });
    if (error) console.error("stale_upload_cleanup_state_failed", error.message);
  }
}
