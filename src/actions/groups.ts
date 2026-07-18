"use server";
import { revalidatePath } from "next/cache";
import { createGroupSchema } from "@/domain/schemas";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { formText, handleActionError, redirectNotice, returnPath } from "./helpers";

export async function createGroupAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/groups");
  try {
    const identity = await requireRole("admin", "teacher");
    const input = createGroupSchema.parse({ name: formText(formData, "name"), description: formText(formData, "description"), ownerTeacherId: formText(formData, "ownerTeacherId") || undefined });
    const group = await (await getStore()).createGroup(identity, input);
    revalidatePath("/app");
    redirectNotice(`/app/${identity.role}/groups/${group.id}`, "تم إنشاء المجموعة");
  } catch (error) { handleActionError(error, path); }
}

export async function transferGroupAction(formData: FormData) {
  const path = returnPath(formData, "/app/admin/groups");
  try {
    const identity = await requireRole("admin");
    await (await getStore()).transferGroup(identity, formText(formData, "groupId"), formText(formData, "ownerTeacherId"));
    revalidatePath("/app");
    redirectNotice(path, "تم نقل ملكية المجموعة");
  } catch (error) { handleActionError(error, path); }
}
