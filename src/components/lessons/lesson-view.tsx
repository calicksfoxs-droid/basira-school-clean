import { Download, FileText, Layers3, Lightbulb, PlayCircle, ShieldCheck } from "lucide-react";
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

function ContentBlock({ identity, lessonId, lessonPartId, assets, quiz }: { identity: Identity; lessonId: string; lessonPartId?: string; assets: Asset[]; quiz?: Quiz }) {
  const video = assets.find((asset) => asset.kind === "video" && asset.state === "ready");
  const handout = assets.find((asset) => asset.kind === "handout" && asset.state === "ready");
  const aid = assets.find((asset) => asset.kind === "aid" && asset.state === "ready");
  const editable = identity.role === "teacher";
  return <div className="grid gap-5">
    <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]"><div className="flex items-center gap-2 p-5 font-heading text-lg font-bold"><PlayCircle className="size-5 text-[var(--brand)]"/>فيديو الدرس</div>{video ? <video controls preload="metadata" className="aspect-video w-full bg-black" src={`/api/files/${video.id}`}/> : <div className="p-5 pt-0"><EmptyState title="لا يوجد فيديو بعد" description={editable ? "اضغط أداة رفع الفيديو أسفل الصفحة." : "سيضيف المعلم الفيديو هنا."}/></div>}</section>
    <FileSection title="ملازم الدرس" icon={<FileText className="size-5 text-emerald-600"/>} asset={handout} empty="لا توجد ملزمة بعد"/>
    <FileSection title="المساعدات" icon={<Lightbulb className="size-5 text-amber-500"/>} asset={aid} empty="لا توجد مساعدات بعد"/>
    <section className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5"><h3 className="font-heading text-lg font-bold">الاختبار</h3>{quiz ? <><p className="mt-1 text-sm text-[var(--muted)]">{quiz.title}</p><div className="mt-4"><LinkButton href={identity.role === "teacher" ? `/app/teacher/quizzes/${quiz.id}/edit` : identity.role === "student" ? `/app/student/quizzes/${quiz.id}` : `/app/admin/lessons/${lessonId}`}>{identity.role === "student" ? "بدء الاختبار" : "فتح الاختبار"}</LinkButton></div></> : <EmptyState title="لا يوجد اختبار بعد"/>}</section>
    {editable && <details className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5"><summary className="focus-ring cursor-pointer list-none font-heading text-lg font-bold text-[var(--brand)]">أدوات رفع محتوى الدرس</summary><div className="mt-5 grid gap-4 lg:grid-cols-3"><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="video"/><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="handout"/><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="aid"/></div><div className="mt-4 rounded-2xl border border-[var(--border)] p-4"><h3 className="font-black">الاختبار</h3><p className="mt-1 text-xs text-[var(--muted)]">اختبار واحد في هذا المكان.</p><div className="mt-4">{quiz ? <LinkButton href={`/app/teacher/quizzes/${quiz.id}/edit`} variant="secondary">فتح الاختبار</LinkButton> : <LinkButton href={`/app/teacher/quizzes/new?lessonId=${encodeURIComponent(lessonId)}${lessonPartId ? `&lessonPartId=${encodeURIComponent(lessonPartId)}` : ""}`}>إنشاء اختبار</LinkButton>}</div></div></details>}
  </div>;
}

export function LessonView({ identity, details }: { identity: Identity; details: LessonDetails }) {
  const editable = identity.role === "teacher";
  const directAssets = details.assets.filter((asset) => asset.lessonId === details.lesson.id);
  return <div className="grid gap-6"><Card><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle className="text-2xl">{details.lesson.title}</CardTitle><CardDescription>{details.lesson.description || (details.group ? `${details.subject.title} — ${details.group.name}` : details.subject.title)}</CardDescription></div><Badge tone={details.lesson.status === "published" ? "success" : "warning"}>{details.lesson.status === "published" ? "منشور" : "مسودة"}</Badge></div></Card>
    {details.lesson.structureMode === "direct" ? <ContentBlock identity={identity} lessonId={details.lesson.id} assets={directAssets} quiz={details.quiz}/> : <div className="grid gap-5">{details.parts.length === 0 ? <EmptyState title="لا توجد أجزاء بعد" description={editable ? "أضف أول جزء، ثم ارفع محتواه." : "لم يجهز المعلم محتوى الدرس بعد."}/> : details.parts.map((part, index) => <Card key={part.id}><div className="mb-5 flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--soft)] font-black text-[var(--brand)]">{index + 1}</div><div><CardTitle>{part.title}</CardTitle><CardDescription>{part.description}</CardDescription></div></div><ContentBlock identity={identity} lessonId={details.lesson.id} lessonPartId={part.id} assets={details.assets.filter((asset) => asset.lessonPartId === part.id)} quiz={details.partQuizzes.find((candidate) => candidate.lessonPartId === part.id)}/></Card>)}
      {editable && details.lesson.status === "draft" && <Card><div className="flex items-center gap-2"><Layers3 className="size-5 text-[var(--brand)]"/><CardTitle>إضافة جزء</CardTitle></div><form action={createLessonPartAction} className="mt-5 grid gap-4"><input type="hidden" name="lessonId" value={details.lesson.id}/><input type="hidden" name="returnTo" value={`/app/teacher/lessons/${details.lesson.id}/edit`}/><Field label="عنوان الجزء"><Input name="title" required/></Field><Field label="وصف اختياري"><Textarea name="description"/></Field><Button>إضافة الجزء</Button></form></Card>}
    </div>}
    {editable ? <Card><CardTitle>النشر</CardTitle><CardDescription>انشر الدرس بعد إضافة الفيديو أو الملزمة أو المساعدة أو الاختبار.</CardDescription><form action={publishLessonAction} className="mt-5"><input type="hidden" name="lessonId" value={details.lesson.id}/><input type="hidden" name="returnTo" value={`/app/teacher/lessons/${details.lesson.id}/edit`}/><Button disabled={details.lesson.status === "published"}>{details.lesson.status === "published" ? "الدرس منشور" : "نشر الدرس"}</Button></form></Card> : <Card><div className="flex gap-3"><ShieldCheck className="size-5 text-emerald-600"/><div><CardTitle>مساحة الطالب</CardTitle><CardDescription>لا تظهر هنا أدوات تعديل أو بيانات خاصة.</CardDescription></div></div></Card>}
  </div>;
}
