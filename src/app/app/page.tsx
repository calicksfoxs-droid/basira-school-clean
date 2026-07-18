import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth";
import { roleHome } from "@/lib/utils";
export default async function AppIndex() { const identity = await requireIdentity(); redirect(roleHome(identity.role)); }
