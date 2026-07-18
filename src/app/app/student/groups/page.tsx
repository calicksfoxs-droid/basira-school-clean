import { GroupGrid } from "@/components/lists/group-grid";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page() { const identity = await requireRole("student"); const groups = await (await getStore()).listGroups(identity); return <><PageHeader title={identity.role === "student" ? "فصولي" : identity.role === "teacher" ? "مجموعاتي" : "كل المجموعات"} description="قائمة بسيطة بدون معلومات لا تحتاجها." action={undefined}/><GroupGrid groups={groups} identity={identity}/></>; }
