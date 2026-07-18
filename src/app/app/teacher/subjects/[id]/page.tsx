import { SubjectView } from "@/components/subjects/subject-view";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) { const identity=await requireRole("teacher"); const details=await (await getStore()).getSubject(identity,(await params).id); return <><PageHeader title="المادة" description="دروس مرتبة وواضحة بدون طبقات زائدة."/><Notice {...(await searchParams)}/><SubjectView identity={identity} details={details}/></>; }
