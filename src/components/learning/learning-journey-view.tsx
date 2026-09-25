import { JourneyPanel } from "./journey-panel";
import Image from "next/image";
import Link from "next/link";
import { Check, Lock, Play } from "lucide-react";
import type { LearningJourneyNode, LearningSubjectDetails } from "@/domain/core-models";
import { completeLearningLessonFormAction as completeLearningLessonAction } from "@/actions/learning-core";
import { Button } from "@/components/ui/button";
import { subjectCoverPath } from "@/lib/subject-covers";

export function LearningJourneyView({ details, nodes, selectedLessonId }: { details: LearningSubjectDetails; nodes: LearningJourneyNode[]; selectedLessonId?: string }) {
  const lessons = new Map(details.lessons.map((lesson) => [lesson.id, lesson]));
  const selected = selectedLessonId ? lessons.get(selectedLessonId) : undefined;
  const completed = nodes.filter(node => node.state === "completed").length;
  return <div className="journey-page overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
    <header className="relative min-h-72 text-white overflow-hidden border-b border-white/10">
      <Image src={subjectCoverPath(details.subject)} alt={`رحلة تعلم ${details.subject.title}`} fill priority sizes="100vw" className="object-cover opacity-65"/>
      <div className="absolute inset-0 bg-[#170b35]/45"/>
      <div className="relative flex min-h-72 flex-col justify-end p-7 sm:p-10"><span className="text-sm font-bold text-cyan-100">رحلة {details.subject.title}</span><h1 className="font-heading mt-2 text-3xl font-bold sm:text-4xl">خطوات صغيرة تبني فهمًا كبيرًا</h1><p className="mt-3 max-w-xl text-white/70">اتبع المسار بالترتيب، وارجع لأي درس متاح عندما تحتاج إلى المراجعة.</p></div>
    </header>
    {nodes.length > 0 && <div className="mx-auto max-w-3xl px-5 pt-8"><div className="mb-3 flex justify-between text-sm font-bold"><span>تقدّمك في المادة</span><span><bdi dir="ltr">{completed} / {nodes.length}</bdi> دروس مكتملة</span></div><progress aria-label="الدروس المكتملة" value={completed} max={nodes.length} className="journey-progress h-2 w-full"/></div>}
    <div className="mx-auto grid max-w-3xl gap-0 px-5 py-12">
      {nodes.length ? nodes.map((node, index) => {
        const lesson = lessons.get(node.lessonId);
        const state = node.state;
        return <div key={node.lessonId} className="relative grid grid-cols-[78px_1fr] items-center gap-5 pb-10">
          {index < nodes.length - 1 && <span className="absolute bottom-0 left-auto right-[38px] top-[72px] w-1 translate-x-1/2 bg-[var(--border)]"/>}
          <div className="order-2 text-right"><span className="text-xs font-bold text-[var(--accent)]">المحطة {node.order}</span><h2 className="font-heading mt-1 text-lg font-bold">{lesson?.title || `الدرس ${node.order}`}</h2><p className="mt-1 text-sm text-[var(--muted)]">{lesson?.description || "خطوة جديدة في رحلة الفهم"}</p></div>
          <Link href={state === "locked" ? "#" : `/app/student/subjects/${details.subject.id}/journey?lesson=${node.lessonId}`} aria-disabled={state === "locked"} tabIndex={state === "locked" ? -1 : undefined} aria-label={`${lesson?.title || `الدرس ${node.order}`} — ${state === "completed" ? "مكتمل" : state === "locked" ? "مغلق" : "متاح"}`} className={`focus-ring relative z-10 grid size-[76px] place-items-center rounded-full border-2 text-lg font-black ${state === "completed" ? "border-emerald-200 bg-emerald-700 text-white" : state === "available" ? "border-[var(--brand)] bg-[var(--primary)] text-[var(--on-primary)]" : "border-[var(--border)] bg-[var(--soft)] text-[var(--muted)]"}`}>
            {state === "completed" ? <Check/> : state === "locked" ? <Lock/> : <Play className="fill-current"/>}
          </Link>
        </div>;
      }) : <div className="rounded-3xl border border-[var(--border)] bg-[var(--soft)] p-8 text-center"><h2 className="font-heading text-xl font-bold">المسار قيد الإعداد</h2><p className="mt-2 text-[var(--muted)]">ستظهر الدروس هنا بعد نشرها.</p></div>}
    </div>
    {selected && <JourneyPanel closeHref={`/app/student/subjects/${details.subject.id}/journey`}>
      <Link href={`/app/student/subjects/${details.subject.id}/journey`} className="focus-ring absolute left-4 top-4 rounded-xl p-2 text-[var(--muted)]" aria-label="إغلاق">×</Link>
      <span className="text-xs font-bold text-[#57e3d2]">الدرس المتاح الآن</span><h2 id="journey-lesson-title" className="font-heading mt-2 text-xl font-bold">{selected.title}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{selected.description || "ابدأ الدرس ثم عد إلى الرحلة لمتابعة تقدّمك."}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><Link href={`/app/student/lessons/${selected.id}`} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#20c7b5] font-black text-[#170b35]"><Play className="size-5 fill-current"/> فتح محتوى الدرس</Link><form action={completeLearningLessonAction}><input type="hidden" name="lessonId" value={selected.id}/><Button className="w-full bg-[#ffd64a] text-[#170b35] hover:bg-[#f3c83c]"><Check className="size-5"/> تسجيل الإكمال</Button></form></div>
    </JourneyPanel>}
  </div>;
}
