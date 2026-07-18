import { GroupGrid } from "@/components/lists/group-grid";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page() { const identity = await requireRole("admin"); const groups = await (await getStore()).listGroups(identity); return <><PageHeader title={identity.role === "student" ? "فصولي" : identity.role === "teacher" ? "مجموعاتي" : "كل المجموعات"} description="قائمة بسيطة بدون معلومات لا تحتاجها." action={<LinkButton href="/app/admin/groups/new">إنشاء مجموعة</LinkButton>}/><GroupGrid groups={groups} identity={identity}/></>; }
