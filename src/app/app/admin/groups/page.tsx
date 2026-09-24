import { GroupGrid } from "@/components/lists/group-grid";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";

export default async function Page() {
  const identity = await requireRole("admin");
  const groups = await (await getStore()).listGroups(identity);
  return <>
    <PageHeader
      title="كل المجموعات"
      description="عرض رقابي للمجموعات الحالية. إنشاء مجموعات جديدة يتم داخل المادة في Learning Core."
    />
    <GroupGrid groups={groups} identity={identity}/>
  </>;
}
