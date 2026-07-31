import { DashboardHome } from "@/components/dashboard/home";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getLearningCoreStore } from "@/lib/core";
export default async function Page() { const identity = await requireRole("teacher"); const core = getLearningCoreStore(); const [summary, subjects, grades] = await Promise.all([(await getStore()).getDashboard(identity), core.listLearningSubjects(identity), core.listCurriculumGrades(identity)]); return <DashboardHome identity={identity} summary={summary} subjects={subjects} grades={grades}/>; }
