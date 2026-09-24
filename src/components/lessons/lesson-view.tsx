import Image from "next/image";
import Link from "next/link";
import { getLearningCoreStore } from "@/lib/core";
import { subjectCoverPath } from "@/lib/subject-covers";
import { LessonVideo, HandoutMedia } from "./lesson-media";
import { Download, FileText, Layers3, PlayCircle, ShieldCheck } from "lucide-react";
import type { Asset, Identity, LessonDetails, Quiz } from "@/domain/models";
import { createLessonPartAction, publishLessonAction } from "@/actions/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { UploadPanel } from "@/components/files/upload-panel";

function FileSection({ title, icon, asset, empty }: { title: string; icon: React.ReactNode; asset?: Asset; empty: string }) {
  return <section className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5"><h3 className="flex items-center gap-2 font-heading text-lg font-bold">{icon}{title}</h3>{asset ? <a href={`/api/files/${asset.id}`} className="focus-ring mt-4 flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-4 font-bold hover:bg-[var(--soft)]"><span className="min-w-0 truncate">{asset.title}</span><Download className="size-5 shrink-0 text-[var(--brand)]"/></a> : <div className="mt-4"><EmptyState title={empty}/></div>}</section>;
}

function ContentBlock({ identity, lessonId, lessonPartId, assets, quiz, cover }: { cover: string; identity: Identity; lessonId: string; lessonPartId?: string; assets: Asset[]; quiz?: Quiz }) {
  const video = assets.find((asset) => asset.kind === "video" && asset.state === "ready");
  const handout = assets.find((asset) => asset.kind === "handout" && asset.state === "ready");
  const editable = identity.role === "teacher";
  const supportedQuiz = quiz && !quiz.hasManualQuestions ? quiz : undefined;
  const legacyQuiz = quiz && quiz.hasManualQuestions ? quiz : undefined;
  return <div className="grid gap-5">
    <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]"><div className="flex items-center gap-2 p-5 font-heading text-lg font-bold"><PlayCircle className="size-5 text-[var(--brand)]"/>فيديو الدرس</div>{video ? <LessonVideo asset={video} poster={cover}/> : <div className="p-5 pt-0"><EmptyState title="لا يوجد فيديو بعد" description={editable ? "اضغط أداة رفع الفيديو أسفل الصفحة." : "سيضيف المعلم الفيديو هنا."}/></div>}</section>
    {handout ? <HandoutMedia asset={handout} cover={cover}/> : <FileSection title="ملازم الدرس" icon={<FileText className="size-5 text-emerald-600"/>} empty="لا توجد ملزمة بعد"/>}
    <section className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5"><h3 className="font-heading text-lg font-bold">الاختبار</h3>{supportedQuiz ? <><p className="mt-1 text-sm text-[var(--muted)]">{supportedQuiz.title}</p><div className="mt-4"><LinkButton href={identity.role === "teacher" ? `/app/teacher/quizzes/${supportedQuiz.id}/edit` : identity.role === "student" ? `/app/student/quizzes/${supportedQuiz.id}` : `/app/admin/lessons/${lessonId}`}>{identity.role === "student" ? "بدء الاختبار" : "فتح الاختبار"}</LinkButton></div></> : legacyQuiz ? <EmptyState title="اختبار قديم غير متاح في Core 1.0" description="الاختبارات المقالية والتصحيح اليدوي خارج السطح المدعوم الحالي."/> : <EmptyState title="لا يوجد اختبار بعد"/>}</section>
    {editable && <details className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5"><summary className="focus-ring cursor-pointer list-none font-heading text-lg font-bold text-[var(--brand)]">أدوات رفع محتوى الدرس</summary><div className="mt-5 grid gap-4 lg:grid-cols-2"><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="video"/><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="handout"/></div><div className="mt-4 rounded-2xl border border-[var(--border)] p-4"><h3 className="font-black">الاختبار</h3><p className="mt-1 text-xs text-[var(--muted)]">اختياري وصح/خطأ فقط مع تصحيح تلقائي.</p><div className="mt-4">{supportedQuiz ? <LinkButton href={`/app/teacher/quizzes/${supportedQuiz.id}/edit`} variant="secondary">فتح الاختبار</LinkButton> : legacyQuiz ? <p className="text-sm font-bold text-[var(--muted)]">يوجد اختبار Legacy هنا؛ لا يمكن تحريره أو استخدامه في Core 1.0.</p> : <LinkButton href={`/app/teacher/quizzes/new?lessonId=${encodeURIComponent(lessonId)}${lessonPartId ? `&lessonPartId=${encodeURIComponent(lessonPartId)}` : ""}`}>إنشاء اختبار</LinkButton>}</div></div></details>}
  </div>;
}

export async function LessonView({ identity, details }: { identity: Identity; details: LessonDetails }) {
  const editable = identity.role === "teacher";
  const subject = details.subject.ownerTeacherId ? await getLearningCoreStore().getLearningSubject(identity, details.subject.id) : undefined;
  const cover = subjectCoverPath(subject?.subject || { title: details.subject.title });
  const sequence = subject?.lessons || [];
  const position = sequence.findIndex(lesson => lesson.id === details.lesson.id);
  const previous = position > 0 ? sequence[position - 1] : undefined;
  const next = position >= 0 ? sequence[position + 1] : undefined;
  const directAssets = details.assets.filter((asset) => asset.lessonId === details.lesson.id);
  return <div className="grid gap-6"><section className="relative overflow-hidden rounded-[26px] bg-[#152846] text-white"><Image src={cover} alt="" fill priority sizes="1100px" className="object-cover opacity-40"/><div className="absolute inset-0 bg-gradient-to-l from-[#10213e]/90 to-[#10213e]/30"/><div className="relative p-7 sm:p-10"><Link href={`/app/${identity.role}/subjects/${details.subject.id}`} className="focus-ring inline-flex min-h-11 items-center rounded-xl text-sm font-bold text-cyan-100">{details.subject.title}</Link><h2 className="font-heading mt-3 text-2xl font-bold sm:text-3xl">{details.lesson.title}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">{details.lesson.description || "شاهد الدرس، راجع الملزمة، ثم اختبر فهمك بالمحتوى المتاح."}</p></div></section><Card><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle className="text-2xl">{details.lesson.title}</CardTitle><CardDescription>{details.lesson.description || (details.group ? `${details.subject.title} — ${details.group.name}` : details.subject.title)}</CardDescription></div><Badge tone={details.lesson.status === "published" ? "success" : "warning"}>{details.lesson.status === "published" ? "منشور" : "مسودة"}</Badge></div></Card>
    {details.lesson.structureMode === "direct" ? <ContentBlock cover={cover} identity={identity} lessonId={details.lesson.id} assets={directAssets} quiz={details.quiz}/> : <div className="grid gap-5">{details.parts.length === 0 ? <EmptyState title="لا توجد أجزاء بعد" description={editable ? "أضف أول جزء، ثم ارفع محتواه." : "لم يجهز المعلم محتوى الدرس بعد."}/> : details.parts.map((part, index) => <Card key={part.id}><div className="mb-5 flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--soft)] font-black text-[var(--brand)]">{index + 1}</div><div><CardTitle>{part.title}</CardTitle><CardDescription>{part.description}</CardDescription></div></div><ContentBlock cover={cover} identity={identity} lessonId={details.lesson.id} lessonPartId={part.id} assets={details.assets.filter((asset) => asset.lessonPartId === part.id)} quiz={details.partQuizzes.find((candidate) => candidate.lessonPartId === part.id)}/></Card>)}
      {editable && details.lesson.status === "draft" && <Card><div className="flex items-center gap-2"><Layers3 className="size-5 text-[var(--brand)]"/><CardTitle>إضافة جزء</CardTitle></div><form action={createLessonPartAction} className="mt-5 grid gap-4"><input type="hidden" name="lessonId" value={details.lesson.id}/><input type="hidden" name="returnTo" value={`/app/teacher/lessons/${details.lesson.id}/edit`}/><Field label="عنوان الجزء"><Input name="title" required/></Field><Field label="وصف اختياري"><Textarea name="description"/></Field><Button>إضافة الجزء</Button></form></Card>}
    </div>}
    {(previous || next) && <nav aria-label="التنقل بين الدروس" className="flex flex-wrap justify-between gap-3">{previous && <LinkButton variant="secondary" href={editable ? `/app/teacher/lessons/${previous.id}/edit` : `/app/${identity.role}/lessons/${previous.id}`}>الدرس السابق · {previous.title}</LinkButton>}{next && <LinkButton variant="secondary" href={editable ? `/app/teacher/lessons/${next.id}/edit` : `/app/${identity.role}/lessons/${next.id}`}>الدرس التالي · {next.title}</LinkButton>}</nav>}
    {editable ? <Card><CardTitle>النشر</CardTitle><CardDescription>انشر الدرس بعد إضافة الفيديو أو الملزمة أو الاختبار.</CardDescription><form action={publishLessonAction} className="mt-5"><input type="hidden" name="lessonId" value={details.lesson.id}/><input type="hidden" name="returnTo" value={`/app/teacher/lessons/${details.lesson.id}/edit`}/><Button disabled={details.lesson.status === "published"}>{details.lesson.status === "published" ? "الدرس منشور" : "نشر الدرس"}</Button></form></Card> : <Card><div className="flex gap-3"><ShieldCheck className="size-5 text-emerald-600"/><div><CardTitle>مساحة الطالب</CardTitle><CardDescription>لا تظهر هنا أدوات تعديل أو بيانات خاصة.</CardDescription></div></div></Card>}
  </div>;
}
