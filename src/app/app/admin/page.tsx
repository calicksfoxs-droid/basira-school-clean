import { DashboardHome } from "@/components/dashboard/home";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getLearningCoreStore } from "@/lib/core";
export default async function Page() { const identity = await requireRole("admin"); const [summary, subjects] = await Promise.all([(await getStore()).getDashboard(identity), getLearningCoreStore().listLearningSubjects(identity)]); return <DashboardHome identity={identity} summary={summary} subjects={subjects}/>; }
