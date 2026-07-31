import Link from "next/link";
import { BookOpen, ChevronLeft, Plus, Trash2 } from "lucide-react";
import type { Identity } from "@/domain/models";
import type { LearningSubjectDetails, TermSegment } from "@/domain/core-models";
import { createLearningLessonAction, createLearningUnitAction, publishLearningLessonAction, publishLearningUnitAction, removeLearningLessonAction } from "@/actions/learning-core";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { UnitCoverUploader } from "@/components/learning/unit-cover-uploader";

const SEGMENTS: Array<{ id: TermSegment; title: string; short: string }> = [
  { id: 1, title: "النصف الأول من الترم الأول", short: "الترم الأول · النصف الأول" },
  { id: 2, title: "النصف الثاني من الترم الأول", short: "الترم الأول · النصف الثاني" },
  { id: 3, title: "النصف الأول من الترم الثاني", short: "الترم الثاني · النصف الأول" },
  { id: 4, title: "النصف الثاني من الترم الثاني", short: "الترم الثاني · النصف الثاني" },
];

export function CurriculumSections({ identity, details }: { identity: Identity; details: LearningSubjectDetails }) {
  const editable = identity.role === "teacher";
  return <section className="grid gap-8">
    <div><h2 className="font-heading text-2xl font-bold">خطة المادة</h2><p className="mt-1 text-sm text-[var(--muted)]">أربعة أقسام ثابتة تجعل المنهج واضحًا من أول الترم إلى آخره.</p></div>
    {SEGMENTS.map((segment) => {
      const units = details.units.filter((unit) => unit.termSegment === segment.id);
      return <section key={segment.id} className="grid gap-4" aria-labelledby={`segment-${segment.id}`}>
        <header className="flex flex-wrap items-end justify-between gap-3"><div><span className="text-xs font-black text-[var(--accent)]">{segment.short}</span><h3 id={`segment-${segment.id}`} className="font-heading mt-1 text-xl font-bold">{segment.title}</h3></div><span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-bold text-[var(--muted)]">{units.length} وحدات</span></header>
        <div className="flex snap-x gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
          {units.map((unit, unitIndex) => {
            const lessons = details.lessons.filter((lesson) => lesson.unitId === unit.id);
            return <article key={unit.id} className="w-[min(86vw,360px)] shrink-0 snap-start overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div className="relative grid aspect-[16/9] place-items-center overflow-hidden bg-gradient-to-br from-[#2b1459] via-[#4b2684] to-[#1479b8] text-white">
                <UnitCoverUploader unitId={unit.id} hasCover={Boolean(unit.coverPath)} editable={editable}/>
                <span className="absolute right-3 top-3 rounded-full bg-black/35 px-3 py-1 text-xs font-black backdrop-blur">الوحدة {unitIndex + 1}</span>
              </div>
              <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-heading text-lg font-bold">{unit.title}</h4><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{unit.description || "وحدة تعليمية مرتبة"}</p></div><span className="shrink-0 rounded-full bg-[var(--soft)] px-2.5 py-1 text-[11px] font-bold">{lessons.length} دروس</span></div>
                <div className="mt-4 grid gap-2">{lessons.length ? lessons.map((lesson, lessonIndex) => <div key={lesson.id} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-[var(--border)] px-3 py-2">
                  <Link href={editable ? `/app/teacher/lessons/${lesson.id}/edit` : `/app/student/lessons/${lesson.id}`} className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--soft)] text-xs font-black text-[var(--brand)]">{lessonIndex + 1}</span><span className="min-w-0"><strong className="block truncate text-sm">{lesson.title}</strong><small className="text-[11px] text-[var(--muted)]">{lesson.status === "published" ? "متاح" : "قيد الإعداد"}</small></span></Link>
                  {editable ? <span className="flex items-center"><ActionForm action={removeLearningLessonAction}><input type="hidden" name="lessonId" value={lesson.id}/><button className="focus-ring grid size-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-red-50 hover:text-red-700" aria-label={`إزالة ${lesson.title}`}><Trash2 className="size-4"/></button></ActionForm>{lesson.status !== "published" && <ActionForm action={publishLearningLessonAction}><input type="hidden" name="lessonId" value={lesson.id}/><button className="focus-ring rounded-xl px-2 py-2 text-[11px] font-black text-[var(--brand)] hover:bg-[var(--soft)]">نشر</button></ActionForm>}</span> : <ChevronLeft className="size-4 text-[var(--brand)]"/>}
                </div>) : <EmptyState title="لا توجد دروس بعد"/>}</div>
                {editable && <ActionForm action={createLearningLessonAction} className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3"><input type="hidden" name="unitId" value={unit.id}/><input type="hidden" name="structureMode" value="direct"/><Input name="title" required placeholder="اسم الدرس" className="min-w-0"/><Button size="sm" aria-label="إضافة درس"><Plus className="size-4"/></Button></ActionForm>}
                {editable && unit.status !== "published" && <ActionForm action={publishLearningUnitAction} className="mt-3"><input type="hidden" name="unitId" value={unit.id}/><Button size="sm" variant="secondary" className="w-full">نشر الوحدة</Button></ActionForm>}
              </div>
            </article>;
          })}
          {editable && <details className="w-[min(86vw,320px)] shrink-0 snap-start rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--canvas)] p-5 open:bg-[var(--surface)]">
            <summary className="focus-ring flex min-h-36 cursor-pointer list-none flex-col items-center justify-center gap-3 rounded-2xl text-center font-black text-[var(--brand)]"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--soft)]"><Plus className="size-6"/></span>إضافة وحدة</summary>
            <ActionForm action={createLearningUnitAction} className="mt-4 grid gap-3"><input type="hidden" name="subjectId" value={details.subject.id}/><input type="hidden" name="termSegment" value={segment.id}/><Input name="title" required placeholder="اسم الوحدة"/><label className="grid gap-1 text-xs font-bold">عدد الدروس المبدئي<Input name="lessonCount" type="number" min="0" max="40" defaultValue="0"/></label><Button><BookOpen className="size-4"/> إنشاء الهيكل</Button></ActionForm>
          </details>}
        </div>
      </section>;
    })}
  </section>;
}
