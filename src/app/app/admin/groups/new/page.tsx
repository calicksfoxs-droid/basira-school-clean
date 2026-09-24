import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole("admin");
  redirect("/app/admin/groups");
}
