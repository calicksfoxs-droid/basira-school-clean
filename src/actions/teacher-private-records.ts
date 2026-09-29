"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { saveTeacherFinanceRecord } from "@/lib/teacher-private-records";
import { formText, handleActionError, redirectNotice, returnPath } from "./helpers";

export async function saveTeacherFinanceRecordAction(formData: FormData) {
  const path = returnPath(formData, "/app/teacher/students");
  try {
    const identity = await requireRole("teacher");
    await saveTeacherFinanceRecord(identity, {
      groupId: formText(formData, "groupId"),
      studentId: formText(formData, "studentId"),
      amountNote: formText(formData, "amountNote") || undefined,
      paymentNote: formText(formData, "paymentNote") || undefined,
    });
    revalidatePath("/app/teacher/students");
  } catch (error) {
    handleActionError(error, path);
  }
  redirectNotice(path, "تم حفظ الملاحظة الخاصة");
}
