import { DashboardHome } from "@/components/dashboard/home";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page() { const identity = await requireRole("student"); const summary = await (await getStore()).getDashboard(identity); return <DashboardHome identity={identity} summary={summary}/>; }
