"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserSchema } from "@/domain/schemas";
import type { ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { AppError } from "@/lib/data/errors";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export type CreateStudentIdentityState = ActionResult<{
  code: string;
  displayName: string;
  studentId: string;
}>;

export async function createStudentIdentityWithRevealAction(
  _previousState: CreateStudentIdentityState,
  formData: FormData,
): Promise<CreateStudentIdentityState> {
  try {
    const identity = await requireRole("admin");
    const parsed = createUserSchema.parse({
      creationRequestId: text(formData, "creationRequestId"),
      displayName: text(formData, "displayName"),
    });
    const created = await (await getStore()).createStudent(identity, parsed);
    revalidatePath("/app/admin/students");

    return {
      ok: true,
      data: {
        code: created.code,
        displayName: created.user.displayName,
        studentId: created.user.id,
      },
      message: "تم إنشاء حساب الطالب. التسجيل في المواد يتم لاحقًا بمعرّف الانضمام.",
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error instanceof AppError ? `[${error.code}] ${error.message}` : error);
    return {
      ok: false,
      error: error instanceof AppError
        ? error.message
        : "تعذر إنشاء حساب الطالب الآن. راجع البيانات وحاول مرة أخرى.",
    };
  }
}
