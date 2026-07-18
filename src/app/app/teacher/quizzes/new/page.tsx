import { QuizBuilder } from "@/components/quiz/quiz-builder";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";

export default async function Page({ searchParams }: { searchParams: Promise<{ lessonId?: string; lessonPartId?: string }> }) {
  const identity = await requireRole("teacher");
  const { lessonId, lessonPartId } = await searchParams;
  if (!lessonId) throw new Error("lessonId is required");
  const details = await (await getStore()).getLesson(identity, lessonId);
  if (lessonPartId && !details.parts.some((part) => part.id === lessonPartId)) throw new Error("lessonPartId is invalid");
  if ((details.lesson.structureMode === "direct" && lessonPartId) || (details.lesson.structureMode === "parts" && !lessonPartId)) throw new Error("Quiz parent does not match lesson structure");
  return <><PageHeader title="إنشاء اختبار" description="أربعة أنواع فقط؛ واضح وسهل التصحيح."/><Card><QuizBuilder lessonId={lessonPartId ? undefined : lessonId} lessonPartId={lessonPartId}/></Card></>;
}
