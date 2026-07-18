import { QuestionList } from "@/components/quiz/question-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const identity=await requireRole("student"); const details=await (await getStore()).getSubmission(identity,(await params).id); const released=details.submission.status === "released"; return <><PageHeader title={details.quiz.title} description={released ? "تم إصدار النتيجة؛ يمكنك الآن مراجعة الإجابات." : "تم استلام التسليم، والأسئلة المقالية تنتظر المعلم."}/><Card><div className="flex flex-wrap items-center justify-between gap-4"><div><CardTitle>{released ? `${details.submission.totalScore} / ${details.quiz.totalPoints}` : "قيد التصحيح"}</CardTitle><CardDescription>{released ? "الدرجة النهائية" : "لن تظهر الإجابات الصحيحة قبل إصدار النتيجة."}</CardDescription></div><Badge tone={released ? "success" : "warning"}>{released ? "النتيجة متاحة" : "قيد التصحيح"}</Badge></div></Card><div className="mt-6"><QuestionList questions={details.questions} answers={details.answers} reveal={released}/></div></>; }
