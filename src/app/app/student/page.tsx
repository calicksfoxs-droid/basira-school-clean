import { DashboardHome } from "@/components/dashboard/home";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getCanonicalDashboardData } from "@/lib/dashboard/canonical-dashboard";

export default async function Page() {
  const identity = await requireRole("student");
  const { summary, subjects, grades, journey } = await getCanonicalDashboardData(identity);

  if (!subjects.length) {
    return <>
      <PageHeader title={`مرحبًا، ${identity.displayName.split(" ")[0]}`} description="ستظهر موادك هنا بعد إتاحة أول مادة تعليمية لك."/>
      <EmptyState title="لا توجد مواد متاحة بعد" description="عند نشر وإتاحة مادة لك ستظهر هنا مباشرة."/>
    </>;
  }

  return <DashboardHome identity={identity} summary={summary} subjects={subjects} grades={grades} journey={journey}/>;
}
