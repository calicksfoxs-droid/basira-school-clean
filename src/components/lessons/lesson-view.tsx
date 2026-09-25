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
import { subjectThemeFromValues } from "@/lib/ui-themes";

function ResourceCard({ asset }: { asset?: Asset }) {
  return <section className="stitch-panel p-5">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold tracking-[.08em] text-[var(--subject-primary)]">PDF RESOURCE</p><h3 className="font-heading mt-1 text-lg font-bold">ملزمة الدرس</h3></div><span className="grid size-10 place-items-center rounded-md bg-[var(--subject-tint)] text-[var(--subject-primary)]"><FileText className="size-5"/></span></div>
    {asset ? <a href={`/api/files/${asset.id}`} className="focus-ring mt-4 grid gap-3 rounded-lg border border-[var(--subject-border)] bg-[var(--subject-tint)] p-4 transition hover:bg-[color-mix(in_srgb,var(--subject-primary)_11%,var(--surface))]">
      <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{asset.title}</p><p className="mt-1 text-xs text-[var(--muted)]">PDF • {(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB</p></div><Download className="size-5 shrink-0 text-[var(--subject-primary)]"/></div>
      <div className="grid h-16 place-items-center rounded-md border border-dashed border-[var(--subject-border)] bg-[var(--surface)] text-xs text-[var(--muted)]">معاينة وفتح المادة التعليمية</div>
    </a> : <div className="mt-4"><EmptyState title="لا توجد ملزمة بعد"/></div>}
  </section>;
}

function QuizCard({ identity, lessonId, quiz }: { identity: Identity; lessonId: string; quiz?: Quiz }) {
  return <section className="stitch-panel p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold tracking-[.08em] text-[var(--subject-primary)]">NEXT ACTION</p><h3 className="font-heading mt-1 text-lg font-bold">اختبار الفهم</h3></div><span className="rounded bg-[var(--subject-tint)] px-2 py-1 text-[11px] font-bold text-[var(--subject-primary)]">MCQ / T-F</span></div>{quiz ? <><p className="mt-3 text-sm text-[var(--muted)]">{quiz.title}</p><div className="mt-4"><LinkButton href={identity.role === "teacher" ? `/app/teacher/quizzes/${quiz.id}/edit` : identity.role === "student" ? `/app/student/quizzes/${quiz.id}` : `/app/admin/lessons/${lessonId}`}>{identity.role === "student" ? "بدء الاختبار" : "فتح الاختبار"}</LinkButton></div></> : <div className="mt-4"><EmptyState title="لا يوجد اختبار بعد"/></div>}</section>;
}

function ContentBlock({ identity, lessonId, lessonPartId, assets, quiz }: { identity: Identity; lessonId: string; lessonPartId?: string; assets: Asset[]; quiz?: Quiz }) {
  const video = assets.find((asset) => asset.kind === "video" && asset.state === "ready");
  const handout = assets.find((asset) => asset.kind === "handout" && asset.state === "ready");
  const editable = identity.role === "teacher";
  return <div className="grid gap-4">
    <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[#10131f] text-white shadow-[0_16px_34px_-20px_rgba(16,19,31,.55)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2"><PlayCircle className="size-5 text-[var(--subject-accent)]"/><span className="text-sm font-semibold">المحاضرة المرئية</span></div>{video && <span className="text-[11px] text-white/55">{video.mimeType === "video/webm" ? "WebM" : "MP4"}</span>}</div>
      {video ? <video controls preload="metadata" className="aspect-video w-full bg-black" src={`/api/files/${video.id}`}/> : <div className="grid aspect-video place-items-center p-6"><div className="text-center"><PlayCircle className="mx-auto size-10 text-white/30"/><p className="mt-3 text-sm font-semibold">لا يوجد فيديو بعد</p><p className="mt-1 text-xs text-white/50">{editable ? "ارفع الفيديو من أدوات المحتوى أسفل الصفحة." : "سيضيف المعلم الفيديو هنا."}</p></div></div>}
    </section>

    <div className="grid gap-4 xl:grid-cols-2"><ResourceCard asset={handout}/><QuizCard identity={identity} lessonId={lessonId} quiz={quiz}/></div>

    {editable && <details className="stitch-panel p-5"><summary className="focus-ring cursor-pointer list-none font-heading text-lg font-bold text-[var(--subject-primary)]">أدوات محتوى الدرس</summary><p className="mt-1 text-xs text-[var(--muted)]">MP4/WebM + PDF + اختبار موضوعي واحد داخل هذا الموضع.</p><div className="mt-5 grid gap-4 lg:grid-cols-2"><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="video"/><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="handout"/></div><div className="mt-4 rounded-lg border border-[var(--border)] p-4"><h3 className="font-semibold">الاختبار</h3><p className="mt-1 text-xs text-[var(--muted)]">اختيار من متعدد وصح/خطأ فقط في Core 1.0.</p><div className="mt-4">{quiz ? <LinkButton href={`/app/teacher/quizzes/${quiz.id}/edit`} variant="secondary">فتح الاختبار</LinkButton> : <LinkButton href={`/app/teacher/quizzes/new?lessonId=${encodeURIComponent(lessonId)}${lessonPartId ? `&lessonPartId=${encodeURIComponent(lessonPartId)}` : ""}`}>إنشاء اختبار</LinkButton>}</div></div></details>}
  </div>;
}

export function LessonView({ identity, details }: { identity: Identity; details: LessonDetails }) {
  const editable = identity.role === "teacher";
  const directAssets = details.assets.filter((asset) => asset.lessonId === details.lesson.id);
  const theme = subjectThemeFromValues(details.subject.title);
  return <div className={`subject-theme-${theme} grid gap-5`}>
    <section className="science-art relative overflow-hidden rounded-lg border border-[var(--subject-border)] bg-[var(--subject-tint)] p-5 sm:p-7">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4"><div className="max-w-3xl"><p className="text-[11px] font-bold tracking-[.08em] text-[var(--subject-primary)]">LESSON EXPERIENCE</p><h1 className="font-heading mt-2 text-2xl font-bold leading-[1.5] sm:text-3xl">{details.lesson.title}</h1><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{details.lesson.description || (details.group ? `${details.subject.title} — ${details.group.name}` : details.subject.title)}</p></div><Badge tone={details.lesson.status === "published" ? "success" : "warning"}>{details.lesson.status === "published" ? "منشور" : "مسودة"}</Badge></div>
    </section>

    {details.lesson.structureMode === "direct" ? <ContentBlock identity={identity} lessonId={details.lesson.id} assets={directAssets} quiz={details.quiz}/> : <div className="grid gap-5">{details.parts.length === 0 ? <EmptyState title="لا توجد أجزاء بعد" description={editable ? "أضف أول جزء، ثم ارفع محتواه." : "لم يجهز المعلم محتوى الدرس بعد."}/> : details.parts.map((part, index) => <Card key={part.id} className="rounded-lg p-5 shadow-none"><div className="mb-5 flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--subject-tint)] text-sm font-bold text-[var(--subject-primary)]">{index + 1}</div><div><CardTitle>{part.title}</CardTitle><CardDescription>{part.description}</CardDescription></div></div><ContentBlock identity={identity} lessonId={details.lesson.id} lessonPartId={part.id} assets={details.assets.filter((asset) => asset.lessonPartId === part.id)} quiz={details.partQuizzes.find((candidate) => candidate.lessonPartId === part.id)}/></Card>)}
      {editable && details.lesson.status === "draft" && <Card className="rounded-lg shadow-none"><div className="flex items-center gap-2"><Layers3 className="size-5 text-[var(--subject-primary)]"/><CardTitle>إضافة جزء</CardTitle></div><form action={createLessonPartAction} className="mt-5 grid gap-4"><input type="hidden" name="lessonId" value={details.lesson.id}/><input type="hidden" name="returnTo" value={`/app/teacher/lessons/${details.lesson.id}/edit`}/><Field label="عنوان الجزء"><Input name="title" required/></Field><Field label="وصف اختياري"><Textarea name="description"/></Field><Button>إضافة الجزء</Button></form></Card>}
    </div>}

    {editable ? <Card className="rounded-lg shadow-none"><CardTitle>النشر</CardTitle><CardDescription>انشر الدرس بعد إضافة الفيديو أو الملزمة أو الاختبار.</CardDescription><form action={publishLessonAction} className="mt-5"><input type="hidden" name="lessonId" value={details.lesson.id}/><input type="hidden" name="returnTo" value={`/app/teacher/lessons/${details.lesson.id}/edit`}/><Button disabled={details.lesson.status === "published"}>{details.lesson.status === "published" ? "الدرس منشور" : "نشر الدرس"}</Button></form></Card> : <Card className="rounded-lg shadow-none"><div className="flex gap-3"><ShieldCheck className="size-5 text-[var(--success)]"/><div><CardTitle>مساحة الطالب</CardTitle><CardDescription>تظهر هنا فقط موارد الدرس والاختبار المتاحان لك.</CardDescription></div></div></Card>}
  </div>;
}
