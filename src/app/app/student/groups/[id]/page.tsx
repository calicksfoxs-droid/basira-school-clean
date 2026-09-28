import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

/**
 * Historical group deep-links no longer expose group details to students.
 * Subject access is derived from membership under RLS and presented through
 * the Learning Core subject/journey surface instead.
 */
export default async function Page() {
  await requireRole("student");
  redirect("/app/student/subjects");
}
