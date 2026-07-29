"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserSchema } from "@/domain/schemas";
import type { ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { AppError } from "@/lib/data/errors";
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

export type CreateStudentRevealState = ActionResult<{
  code: string;
  displayName: string;
}>;

/**
 * Creates a student and returns the credential exactly once to the hydrated
 * form that initiated the request. The credential is never placed in a URL,
 * cookie, localStorage, or a later list response.
 */
export async function createStudentWithRevealAction(
  _previousState: CreateStudentRevealState,
  formData: FormData,
): Promise<CreateStudentRevealState> {
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
    revalidatePath(path);

    return {
      ok: true,
      data: { code: created.code, displayName: created.user.displayName },
      message: "تم إنشاء الطالب وإصدار رمز الدخول",
    };
  } catch (error) {
    console.error(error instanceof AppError ? `[${error.code}] ${error.message}` : error);
    return {
      ok: false,
      error: error instanceof AppError
        ? error.message
        : "تعذر إنشاء الطالب الآن. راجع البيانات وحاول مرة أخرى.",
    };
  }
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
