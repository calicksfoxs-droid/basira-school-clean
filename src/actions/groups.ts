"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { AppError } from "@/lib/data/errors";
import { CORE1_CAPABILITIES, CORE1_DISABLED_MESSAGE } from "@/lib/release/core1-capabilities";
import { formText, handleActionError, redirectNotice, returnPath } from "./helpers";

export async function createGroupAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/grades");
  try {
    await requireRole("admin", "teacher");
    if (!CORE1_CAPABILITIES.legacyNewAuthoring) throw new AppError(CORE1_DISABLED_MESSAGE, "CORE1_DISABLED", 409);
  } catch (error) {
    handleActionError(error, path);
  }
  redirectNotice(path, CORE1_DISABLED_MESSAGE, "error");
}

export async function transferGroupAction(formData: FormData) {
  const path = returnPath(formData, "/app/admin/groups");
  try {
    const identity = await requireRole("admin");
    await (await getStore()).transferGroup(identity, formText(formData, "groupId"), formText(formData, "ownerTeacherId"));
    revalidatePath("/app");
  } catch (error) {
    handleActionError(error, path);
  }

  redirectNotice(path, "تم نقل ملكية المجموعة");
}
