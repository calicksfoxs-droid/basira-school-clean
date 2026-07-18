import { GroupDetailsView } from "@/components/groups/group-details-view";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) { const identity=await requireRole("admin"); const store=await getStore(); const details=await store.getGroup(identity,(await params).id); const teachers=identity.role === "admin" ? await store.listUsers(identity,"teacher") : undefined; return <><PageHeader title="تفاصيل المجموعة" description="كل شيء متعلق بالمجموعة في مكان واحد."/><Notice {...(await searchParams)}/><GroupDetailsView details={details} identity={identity} teachers={teachers}/></>; }
