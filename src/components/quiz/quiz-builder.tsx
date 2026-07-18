"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CirclePlus, GripVertical, Trash2 } from "lucide-react";
import { createQuizAction } from "@/actions/quiz";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { QuestionType } from "@/domain/models";

type DraftQuestion = { id: string; type: QuestionType; prompt: string; points: number; options: Array<{ text: string; isCorrect: boolean }>; correctBoolean?: boolean };
const makeQuestion = (): DraftQuestion => ({ id: crypto.randomUUID(), type: "mcq", prompt: "", points: 1, options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] });

export function QuizBuilder({ lessonId, lessonPartId }: { lessonId?: string; lessonPartId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([makeQuestion()]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  function update(id: string, patch: Partial<DraftQuestion>) { setQuestions((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await createQuizAction({ lessonId, lessonPartId, title, instructions, questions: questions.map((question) => ({ type: question.type, prompt: question.prompt, points: question.points, options: question.options, correctBoolean: question.correctBoolean })) });
      if (!result.ok) setError(result.error);
      else router.push(`/app/teacher/quizzes/${result.quizId}/edit`);
    });
  }
  return <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="عنوان الاختبار"><Input value={title} onChange={(e) => setTitle(e.target.value)} required/></Field><Field label="تعليمات قصيرة"><Input value={instructions} onChange={(e) => setInstructions(e.target.value)}/></Field></div>{questions.map((question, index) => <Card key={question.id} className="relative"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><GripVertical className="size-4 text-slate-400"/><strong>السؤال {index + 1}</strong></div><Button variant="ghost" size="sm" disabled={questions.length === 1} onClick={() => setQuestions((items) => items.filter((item) => item.id !== question.id))}><Trash2 className="size-4"/> حذف</Button></div><div className="grid gap-4"><div className="grid gap-4 sm:grid-cols-[200px_1fr_120px]"><Field label="النوع"><Select value={question.type} onChange={(e) => update(question.id, { type: e.target.value as QuestionType, options: e.target.value === "mcq" ? question.options.length ? question.options : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] : [] })}><option value="mcq">اختياري</option><option value="true_false">صح / خطأ</option><option value="essay_text">مقالي نصي</option><option value="essay_file">مقالي بملف</option></Select></Field><Field label="نص السؤال"><Textarea className="min-h-20" value={question.prompt} onChange={(e) => update(question.id, { prompt: e.target.value })}/></Field><Field label="الدرجة"><Input type="number" min={1} max={100} value={question.points} onChange={(e) => update(question.id, { points: Number(e.target.value) })}/></Field></div>{question.type === "mcq" && <div className="grid gap-3">{question.options.map((option, optionIndex) => <div key={optionIndex} className="grid grid-cols-[auto_1fr_auto] items-center gap-3"><input type="radio" name={`correct_${question.id}`} checked={option.isCorrect} onChange={() => update(question.id, { options: question.options.map((item, current) => ({ ...item, isCorrect: current === optionIndex })) })}/><Input value={option.text} onChange={(e) => update(question.id, { options: question.options.map((item, current) => current === optionIndex ? { ...item, text: e.target.value } : item) })}/><Button variant="ghost" size="sm" disabled={question.options.length <= 2} onClick={() => update(question.id, { options: question.options.filter((_, current) => current !== optionIndex).map((item, current) => ({ ...item, isCorrect: current === 0 ? true : item.isCorrect })) })}>حذف</Button></div>)}<Button variant="secondary" size="sm" onClick={() => update(question.id, { options: [...question.options, { text: "", isCorrect: false }] })}><CirclePlus className="size-4"/> إضافة خيار</Button></div>}{question.type === "true_false" && <Field label="الإجابة الصحيحة"><Select value={String(question.correctBoolean ?? true)} onChange={(e) => update(question.id, { correctBoolean: e.target.value === "true" })}><option value="true">صح</option><option value="false">خطأ</option></Select></Field>}</div></Card>)}<div className="flex flex-wrap items-center gap-3"><Button variant="secondary" onClick={() => setQuestions((items) => [...items, makeQuestion()])}><CirclePlus className="size-4"/> سؤال جديد</Button><Button disabled={pending} onClick={submit}>{pending ? "جارٍ الحفظ..." : "حفظ ونشر الاختبار"}</Button>{error && <p className="text-sm font-bold text-red-600">{error}</p>}</div></div>;
}
