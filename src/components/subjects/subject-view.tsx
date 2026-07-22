import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import type { Identity, SubjectDetails } from "@/domain/models";
import { createLessonAction } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function SubjectView({ identity, details }: { identity: Identity; details: SubjectDetails }) {
  if (!details.group) throw new Error("Legacy subject view requires a group");
  const lessonHref = (id: string) => identity.role === "teacher" ? `/app/teacher/lessons/${id}/edit` : `/app/${identity.role}/lessons/${id}`;
  return <div className="grid gap-6 xl:grid-cols-[1fr_370px]"><Card><CardTitle>{details.subject.title}</CardTitle><CardDescription>{details.subject.description || `مادة ضمن ${details.group.name}`}</CardDescription><div className="mt-6 grid gap-3">{details.lessons.length ? details.lessons.map((lesson) => <Link key={lesson.id} href={lessonHref(lesson.id)} className="focus-ring flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-sky-200 hover:bg-sky-50/40"><span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-[#1479b8]"><BookOpen className="size-5"/></span><span><strong className="block">{lesson.title}</strong><small className="text-slate-500">{lesson.structureMode === "direct" ? "درس بسيط" : "درس مقسم إلى أجزاء"}</small></span></span><Badge tone={lesson.status === "published" ? "success" : "warning"}>{lesson.status === "published" ? "منشور" : "مسودة"}</Badge></Link>) : <EmptyState title="لا توجد دروس" description={identity.role === "teacher" ? "أنشئ الدرس الأول من النموذج." : "لم ينشر المعلم درسًا بعد."}/>}</div></Card>{identity.role === "teacher" ? <Card><CardTitle className="flex items-center gap-2"><Plus className="size-5"/> درس جديد</CardTitle><form action={createLessonAction} className="mt-5 grid gap-4"><input type="hidden" name="subjectId" value={details.subject.id}/><input type="hidden" name="returnTo" value={`/app/teacher/subjects/${details.subject.id}`}/><Field label="عنوان الدرس"><Input name="title" required/></Field><Field label="الوصف"><Textarea name="description"/></Field><Field label="طريقة بناء الدرس"><Select name="structureMode" defaultValue="direct"><option value="direct">مباشر: فيديو + ملزمة + اختبار</option><option value="parts">أجزاء مرتبة</option></Select></Field><Button>إنشاء مسودة</Button></form></Card> : <Card><CardTitle>المجموعة</CardTitle><CardDescription>{details.group.name}</CardDescription></Card>}</div>;
}
