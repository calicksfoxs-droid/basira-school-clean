import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole("teacher");
  redirect("/app/teacher/grades");
}
