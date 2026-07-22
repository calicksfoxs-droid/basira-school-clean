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

function ContentBlock({ identity, lessonId, lessonPartId, assets, quiz }: { identity: Identity; lessonId: string; lessonPartId?: string; assets: Asset[]; quiz?: Quiz }) {
  const video = assets.find((asset) => asset.kind === "video" && asset.state === "ready");
  const handout = assets.find((asset) => asset.kind === "handout" && asset.state === "ready");
  const editable = identity.role === "teacher";
  return <div className="grid gap-5 lg:grid-cols-[1fr_310px]">
    <div className="grid gap-5">
      <div className="rounded-2xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 font-black"><PlayCircle className="size-5 text-[#1479b8]"/> الفيديو</h3>
        {video ? <div className="mt-4 overflow-hidden rounded-xl bg-black"><video controls preload="metadata" className="aspect-video w-full" src={`/api/files/${video.id}`}/></div> : <div className="mt-4"><EmptyState title="لا يوجد فيديو جاهز" description={editable ? "ارفع فيديو MP4 أو WebM." : "يمكنك متابعة الملزمة أو الاختبار إن وُجدا."}/></div>}
      </div>
      <div className="rounded-2xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 font-black"><FileText className="size-5 text-emerald-600"/> الملزمة</h3>
        {handout ? <a href={`/api/files/${handout.id}`} className="focus-ring mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-4 font-bold hover:bg-slate-50"><span>{handout.title}</span><Download className="size-5 text-[#1479b8]"/></a> : <div className="mt-4"><EmptyState title="لا توجد ملزمة"/></div>}
      </div>
      {quiz && <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">الاختبار</h3><p className="mt-1 text-sm text-slate-500">{quiz.title}</p><div className="mt-4"><LinkButton href={identity.role === "teacher" ? `/app/teacher/quizzes/${quiz.id}/edit` : identity.role === "student" ? `/app/student/quizzes/${quiz.id}` : `/app/admin/lessons/${lessonId}`}>{identity.role === "student" ? "بدء الاختبار" : "عرض الاختبار"}</LinkButton></div></div>}
    </div>
    {editable && <div className="grid content-start gap-4"><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="video"/><UploadPanel lessonId={lessonId} lessonPartId={lessonPartId} kind="handout"/><div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">الاختبار</h3><p className="mt-1 text-xs leading-6 text-slate-500">اختبار واحد فقط في هذا المكان.</p><div className="mt-4">{quiz ? <LinkButton href={`/app/teacher/quizzes/${quiz.id}/edit`} variant="secondary">فتح الاختبار</LinkButton> : <LinkButton href={`/app/teacher/quizzes/new?lessonId=${encodeURIComponent(lessonId)}${lessonPartId ? `&lessonPartId=${encodeURIComponent(lessonPartId)}` : ""}`}>إنشاء اختبار</LinkButton>}</div></div></div>}
  </div>;
}

export function LessonView({ identity, details }: { identity: Identity; details: LessonDetails }) {
  const editable = identity.role === "teacher";
  const directAssets = details.assets.filter((asset) => asset.lessonId === details.lesson.id);
  return <div className="grid gap-6">
    <Card><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle className="text-2xl">{details.lesson.title}</CardTitle><CardDescription>{details.lesson.description || (details.group ? `${details.subject.title} — ${details.group.name}` : details.subject.title)}</CardDescription></div><Badge tone={details.lesson.status === "published" ? "success" : "warning"}>{details.lesson.status === "published" ? "منشور" : "مسودة"}</Badge></div><div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-500"><span className="rounded-full bg-slate-100 px-3 py-1">{details.lesson.structureMode === "direct" ? "درس مباشر" : "درس بأجزاء"}</span><span className="rounded-full bg-slate-100 px-3 py-1">{details.subject.title}</span></div></Card>

    {details.lesson.structureMode === "direct" ? <Card><ContentBlock identity={identity} lessonId={details.lesson.id} assets={directAssets} quiz={details.quiz}/></Card> : <div className="grid gap-5">
      {details.parts.length === 0 ? <EmptyState title="لا توجد أجزاء بعد" description={editable ? "أضف أول جزء، ثم ارفع محتواه." : "لم يجهز المعلم محتوى الدرس بعد."}/> : details.parts.map((part, index) => <Card key={part.id}><div className="mb-5 flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 font-black text-[#1479b8]">{index + 1}</div><div><CardTitle>{part.title}</CardTitle><CardDescription>{part.description}</CardDescription></div></div><ContentBlock identity={identity} lessonId={details.lesson.id} lessonPartId={part.id} assets={details.assets.filter((asset) => asset.lessonPartId === part.id)} quiz={details.partQuizzes.find((quiz) => quiz.lessonPartId === part.id)}/></Card>)}
      {editable && details.lesson.status === "draft" && <Card><div className="flex items-center gap-2"><Layers3 className="size-5 text-[#1479b8]"/><CardTitle>إضافة جزء</CardTitle></div><form action={createLessonPartAction} className="mt-5 grid gap-4"><input type="hidden" name="lessonId" value={details.lesson.id}/><input type="hidden" name="returnTo" value={`/app/teacher/lessons/${details.lesson.id}/edit`}/><Field label="عنوان الجزء"><Input name="title" required/></Field><Field label="وصف اختياري"><Textarea name="description"/></Field><Button>إضافة الجزء</Button></form></Card>}
    </div>}

    {editable ? <Card><CardTitle>النشر</CardTitle><CardDescription>{details.lesson.structureMode === "direct" ? "يحتاج الدرس عنصرًا جاهزًا واحدًا على الأقل." : "يجب أن يحتوي كل جزء على فيديو أو ملزمة أو اختبار."}</CardDescription><form action={publishLessonAction} className="mt-5"><input type="hidden" name="lessonId" value={details.lesson.id}/><input type="hidden" name="returnTo" value={`/app/teacher/lessons/${details.lesson.id}/edit`}/><Button disabled={details.lesson.status === "published"}>{details.lesson.status === "published" ? "الدرس منشور" : "نشر الدرس"}</Button></form></Card> : <Card><div className="flex gap-3"><ShieldCheck className="size-5 text-emerald-600"/><div><CardTitle>مساحة الطالب</CardTitle><CardDescription>لا تظهر هنا أي أدوات تعديل أو بيانات خاصة.</CardDescription></div></div></Card>}
  </div>;
}
