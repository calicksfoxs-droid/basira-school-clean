import { DashboardHome } from "@/components/dashboard/home";
import { requireRole } from "@/lib/auth";
import { getCanonicalDashboardData } from "@/lib/dashboard/canonical-dashboard";

export default async function Page() {
  const identity = await requireRole("student");
  const { summary, subjects, grades, journey } = await getCanonicalDashboardData(identity);
  return <DashboardHome identity={identity} summary={summary} subjects={subjects} grades={grades} journey={journey}/>;
}
