import { QuestionList } from "@/components/quiz/question-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const identity=await requireRole("teacher"); const details=await (await getStore()).getQuiz(identity,(await params).id); return <><PageHeader title={details.quiz.title} description="بعد أول تسليم تُقفل الإجابات الصحيحة وبنية الأسئلة."/><Card><div className="flex items-center justify-between"><div><CardTitle>الأسئلة</CardTitle><CardDescription>{details.quiz.instructions}</CardDescription></div><Badge tone="success">منشور</Badge></div><div className="mt-6"><QuestionList questions={details.questions} reveal/></div></Card></>; }
