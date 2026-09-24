import { GroupGrid } from "@/components/lists/group-grid";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page() { const identity = await requireRole("teacher"); const groups = await (await getStore()).listGroups(identity); return <><PageHeader title="مجموعات Legacy" description="للقراءة والتوافق فقط في Core 1.0. أنشئ المجموعات الجديدة من صفوفي داخل Learning Core."/><GroupGrid groups={groups} identity={identity}/></>; }
