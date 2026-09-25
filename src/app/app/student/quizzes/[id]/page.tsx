import { submitQuizFormAction } from "@/actions/quiz";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { redirect } from "next/navigation";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const identity = await requireRole("student");
  const details = await (await getStore()).getQuiz(identity, (await params).id);
  if (details.existingSubmission) redirect(`/app/student/results/${details.existingSubmission.id}`);
  const supported = details.questions.every((question) => question.type === "mcq" || question.type === "true_false");
  if (!supported) redirect(`/app/student/lessons/${details.lesson.id}`);

  return <>
    <PageHeader title={details.quiz.title} description={details.quiz.instructions || "أجب عن كل الأسئلة ثم راجع قبل التسليم."}/>
    <Notice {...(await searchParams)}/>
    <form action={submitQuizFormAction} className="grid gap-5">
      <input type="hidden" name="quizId" value={details.quiz.id}/>
      {details.questions.map((question, index) => <Card key={question.id}>
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-bold text-[var(--accent)]">السؤال {index + 1}</p><CardTitle className="mt-1">{question.prompt}</CardTitle></div>
          <span className="text-xs font-bold text-[var(--muted)]">{question.points} درجات</span>
        </div>
        <div className="mt-5">
          {question.type === "mcq" && <div className="grid gap-3">{question.options?.map((option) =>
            <label key={option.id} className="focus-within:ring-2 focus-within:ring-[var(--accent)] flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] p-4">
              <input type="radio" name={`question_${question.id}`} value={option.id} required={question.required}/>
              <span>{option.text}</span>
            </label>
          )}</div>}
          {question.type === "true_false" && <div className="grid grid-cols-2 gap-3">
            {[{ value: "true", label: "صح" }, { value: "false", label: "خطأ" }].map((choice) =>
              <label key={choice.value} className="focus-within:ring-2 focus-within:ring-[var(--accent)] flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] p-4">
                <input type="radio" name={`question_${question.id}`} value={choice.value} required={question.required}/>
                <span>{choice.label}</span>
              </label>
            )}
          </div>}
        </div>
      </Card>)}
      <div className="sticky bottom-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-4 shadow-xl backdrop-blur">
        <Button size="lg" className="w-full">تسليم الاختبار نهائيًا</Button>
        <p className="mt-2 text-center text-xs text-[var(--muted)]">محاولة واحدة. التصحيح تلقائي والنتيجة تظهر فور التسليم.</p>
      </div>
    </form>
  </>;
}
