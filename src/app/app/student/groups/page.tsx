import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

/**
 * Compatibility route only. Groups are an enrollment/authorization detail in
 * Learning Core; the student's product surface is subjects and learning paths.
 */
export default async function Page() {
  await requireRole("student");
  redirect("/app/student/subjects");
}
