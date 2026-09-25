import Link from "next/link";
import { Check, Lock, Play, Route } from "lucide-react";
import type { LearningJourneyNode, LearningSubjectDetails } from "@/domain/core-models";
import { completeLearningLessonFormAction as completeLearningLessonAction } from "@/actions/learning-core";
import { Button } from "@/components/ui/button";
import { subjectTheme, subjectThemeMeta } from "@/lib/ui-themes";

export function LearningJourneyView({ details, nodes, selectedLessonId }: { details: LearningSubjectDetails; nodes: LearningJourneyNode[]; selectedLessonId?: string }) {
  const lessons = new Map(details.lessons.map((lesson) => [lesson.id, lesson]));
  const selected = selectedLessonId ? lessons.get(selectedLessonId) : undefined;
  const theme = subjectTheme(details.subject);
  const meta = subjectThemeMeta[theme];
  const completed = nodes.filter((node) => node.state === "completed").length;
  const progress = nodes.length ? Math.round((completed / nodes.length) * 100) : 0;

  return <div className={`subject-theme-${theme} grid gap-6`}>
    <header className="science-art relative overflow-hidden rounded-lg border border-[var(--subject-border)] bg-[var(--subject-tint)] p-6 sm:p-8">
      <div className="relative z-10 max-w-3xl"><div className="flex items-center gap-2"><span className="grid size-10 place-items-center rounded-md bg-[var(--surface)] text-[var(--subject-primary)]"><Route className="size-5"/></span><span className="text-[11px] font-bold tracking-[.08em] text-[var(--subject-primary)]">{meta.eyebrow} / LEARNING JOURNEY</span></div><h1 className="font-heading mt-5 text-3xl font-bold sm:text-4xl">{details.subject.title}</h1><p className="mt-3 max-w-2xl text-sm leading-8 text-[var(--muted)]">مسار بصري متسلسل يوضح ما أتممته، ما يمكنك فتحه الآن، وما يزال مقفلًا حتى تكمل الخطوة السابقة.</p><div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold"><span className="rounded bg-[var(--surface)] px-3 py-2">{progress}% مكتمل</span><span className="rounded bg-[var(--surface)] px-3 py-2">{completed} من {nodes.length} محطة</span></div></div>
    </header>

    <section className="stitch-panel overflow-hidden p-4 sm:p-7">
      {nodes.length ? <div className="relative mx-auto grid max-w-4xl gap-4 sm:gap-6">
        <div className="absolute bottom-8 top-8 right-[27px] w-px bg-[var(--border)] sm:right-1/2 sm:translate-x-1/2"/>
        {nodes.map((node, index) => {
          const lesson = lessons.get(node.lessonId);
          const state = node.state;
          const left = index % 2 === 1;
          return <div key={node.lessonId} className={`relative z-10 grid grid-cols-[56px_1fr] items-center gap-4 sm:grid-cols-[1fr_64px_1fr] ${left ? "sm:[&>*:first-child]:order-3" : ""}`}>
            <div className={`${left ? "sm:text-left" : "sm:text-right"} hidden sm:block`}>{!left && <><span className="text-[11px] font-bold text-[var(--subject-primary)]">المحطة {node.order}</span><h2 className="font-heading mt-1 text-lg font-bold">{lesson?.title || `الدرس ${node.order}`}</h2><p className="mt-1 text-xs leading-6 text-[var(--muted)]">{lesson?.description || "خطوة جديدة في المسار"}</p></>}</div>
            <Link href={state === "locked" ? "#" : `/app/student/subjects/${details.subject.id}/journey?lesson=${node.lessonId}`} aria-disabled={state === "locked"} className={`focus-ring grid place-items-center rounded-full border transition ${state === "completed" ? "size-10 border-[var(--subject-primary)] bg-[var(--subject-primary)] text-white" : state === "available" ? "journey-node-current size-12 border-2 border-[var(--subject-primary)] bg-[var(--surface)] text-[var(--subject-primary)]" : "size-9 border-[var(--border)] bg-[var(--soft)] text-[var(--muted)]"}`}>
              {state === "completed" ? <Check className="size-4"/> : state === "locked" ? <Lock className="size-4"/> : <Play className="size-4 fill-current"/>}
            </Link>
            <div className={`${left ? "sm:text-right" : "sm:text-left"}`}><div className="sm:hidden"><span className="text-[11px] font-bold text-[var(--subject-primary)]">المحطة {node.order}</span><h2 className="font-heading mt-1 text-base font-bold">{lesson?.title || `الدرس ${node.order}`}</h2><p className="mt-1 text-xs leading-6 text-[var(--muted)]">{lesson?.description || "خطوة جديدة في المسار"}</p></div>{left && <div className="hidden sm:block"><span className="text-[11px] font-bold text-[var(--subject-primary)]">المحطة {node.order}</span><h2 className="font-heading mt-1 text-lg font-bold">{lesson?.title || `الدرس ${node.order}`}</h2><p className="mt-1 text-xs leading-6 text-[var(--muted)]">{lesson?.description || "خطوة جديدة في المسار"}</p></div>}</div>
          </div>;
        })}
      </div> : <div className="p-8 text-center"><h2 className="font-heading text-xl font-bold">المسار قيد الإعداد</h2><p className="mt-2 text-sm text-[var(--muted)]">ستظهر الدروس هنا بعد نشرها.</p></div>}
    </section>

    {selected && <aside className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-2xl rounded-lg border border-[var(--subject-border)] bg-[var(--surface)] p-5 shadow-[0_18px_44px_-14px_rgba(23,27,46,.28)] sm:bottom-6" role="dialog" aria-modal="true" aria-labelledby="journey-lesson-title">
      <Link href={`/app/student/subjects/${details.subject.id}/journey`} className="focus-ring absolute left-3 top-3 grid size-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--soft)]" aria-label="إغلاق">×</Link>
      <span className="text-[11px] font-bold tracking-[.08em] text-[var(--subject-primary)]">AVAILABLE NOW</span><h2 id="journey-lesson-title" className="font-heading mt-2 text-xl font-bold">{selected.title}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{selected.description || "ابدأ الدرس ثم عد إلى الرحلة لمتابعة تقدّمك."}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><Link href={`/app/student/lessons/${selected.id}`} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--subject-primary)] font-semibold text-white"><Play className="size-4 fill-current"/>فتح محتوى الدرس</Link><form action={completeLearningLessonAction}><input type="hidden" name="lessonId" value={selected.id}/><Button className="w-full rounded-md bg-[var(--surface)] text-[var(--subject-primary)] ring-1 ring-[var(--subject-border)] hover:bg-[var(--subject-tint)]"><Check className="size-4"/>تسجيل الإكمال</Button></form></div>
    </aside>}
  </div>;
}
