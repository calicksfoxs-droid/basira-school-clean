import { LessonView } from "@/components/lessons/lesson-view";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) { const identity=await requireRole("teacher"); const details=await (await getStore()).getLesson(identity,(await params).id); return <><PageHeader title="محرر الدرس" description="فيديو واحد، ملزمة واحدة، واختبار واحد — بوضوح."/><Notice {...(await searchParams)}/><LessonView identity={identity} details={details}/></>; }
