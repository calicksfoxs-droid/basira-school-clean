"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserSchema } from "@/domain/schemas";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { setAccessCodeFlash } from "@/lib/flash";
import { formText, handleActionError, redirectNotice, returnPath } from "./helpers";

export async function createTeacherAction(formData: FormData) {
  const path = returnPath(formData, "/app/admin/teachers");
  try {
    const identity = await requireRole("admin");
    const parsed = createUserSchema.parse({ displayName: formText(formData, "displayName") });
    const created = await (await getStore()).createTeacher(identity, parsed);
    await setAccessCodeFlash(created.code, created.user.displayName);
    revalidatePath("/app/admin");
  } catch (error) {
    handleActionError(error, path);
  }

  redirect("/app/access-code");
}

export async function createStudentAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/students");
  try {
    const identity = await requireRole("admin", "teacher");
    const parsed = createUserSchema.parse({
      displayName: formText(formData, "displayName"),
      groupId: formText(formData, "groupId") || undefined,
      contactNumber: formText(formData, "contactNumber") || undefined,
      amountNote: formText(formData, "amountNote") || undefined,
      paymentNote: formText(formData, "paymentNote") || undefined,
    });
    const created = await (await getStore()).createStudent(identity, parsed);
    await setAccessCodeFlash(created.code, created.user.displayName);
    revalidatePath("/app");
  } catch (error) {
    handleActionError(error, path);
  }

  redirect("/app/access-code");
}

export async function resetAccessCodeAction(formData: FormData) {
  const path = returnPath(formData, "/app");
  try {
    // Resetting a credential invalidates access globally. Keep this operation at
    // the platform-admin boundary; teachers manage enrolment, not identities.
    const identity = await requireRole("admin");
    const userId = formText(formData, "userId");
    const created = await (await getStore()).resetAccessCode(identity, userId);
    await setAccessCodeFlash(created.code, created.user.displayName);
  } catch (error) {
    handleActionError(error, path);
  }

  redirect("/app/access-code");
}

export async function disableUserAction(formData: FormData) {
  const path = returnPath(formData, "/app");
  try {
    // Disabling a shared account affects every teacher who enrolled the student.
    const identity = await requireRole("admin");
    await (await getStore()).disableUser(identity, formText(formData, "userId"));
    revalidatePath(path);
  } catch (error) {
    handleActionError(error, path);
  }

  redirectNotice(path, "تم تعطيل الحساب");
}
