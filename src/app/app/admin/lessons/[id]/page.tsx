import { LessonView } from "@/components/lessons/lesson-view";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const identity=await requireRole("admin"); const details=await (await getStore()).getLesson(identity,(await params).id); return <><PageHeader title="الدرس" description="المحتوى المطلوب فقط."/><LessonView identity={identity} details={details}/></>; }
