"use server";
import { revalidatePath } from "next/cache";
import { announcementSchema } from "@/domain/schemas";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { formText, handleActionError, redirectNotice, returnPath } from "./helpers";

export async function createAnnouncementAction(formData: FormData) {
  const path = returnPath(formData, "/app");
  try {
    const identity = await requireRole("admin", "teacher");
    const parsed = announcementSchema.parse({
      targetType: formText(formData, "targetType"),
      groupId: formText(formData, "groupId") || undefined,
      title: formText(formData, "title"),
      body: formText(formData, "body"),
      ctaLabel: formText(formData, "ctaLabel") || undefined,
      ctaPath: formText(formData, "ctaPath") || undefined
    });
    await (await getStore()).createAnnouncement(identity, parsed);
    revalidatePath("/app");
  } catch (error) {
    handleActionError(error, path);
  }

  redirectNotice(path, "تم نشر الإعلان");
}
