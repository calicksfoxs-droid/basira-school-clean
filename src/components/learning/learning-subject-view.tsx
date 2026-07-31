import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronLeft, Compass, Layers3, Plus, Users } from "lucide-react";
import type { Identity } from "@/domain/models";
import type { LearningSubjectDetails } from "@/domain/core-models";
import {
  createLearningLessonAction,
  publishLearningLessonAction,
  publishLearningSubjectAction,
  publishLearningUnitAction,
} from "@/actions/learning-core";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { SubjectAuthoringToolbar } from "@/components/learning/subject-authoring-toolbar";
import { subjectCoverPath } from "@/lib/subject-covers";

export function LearningSubjectView({ identity, details }: { identity: Identity; details: LearningSubjectDetails }) {
  const editable = identity.role === "teacher";
  const lessonsByUnit = new Map(details.units.map((unit) => [unit.id, details.lessons.filter((lesson) => lesson.unitId === unit.id)]));
  return <div className="grid gap-6">
    <section className="relative min-h-[300px] overflow-hidden rounded-[28px] bg-[#2b1459] text-white">
      <Image data-testid="subject-hero-cover" src={subjectCoverPath(details.subject)} alt="" fill priority sizes="(max-width: 1024px) 100vw, 1100px" className="object-cover"/>
      <div className="absolute inset-0 bg-[#170b35]/55"/>
      <div className="relative flex min-h-[300px] max-w-2xl flex-col items-start justify-end p-7 sm:p-10">
        <span className="mb-3 rounded-full bg-[#20c7b5] px-3 py-1 text-xs font-black text-[#170b35]">{details.subject.status === "published" ? "مادة منشورة" : "مسودة"}</span>
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">{details.subject.bannerTitle || details.subject.title}</h1>
        <p className="mt-3 max-w-xl leading-8 text-white/80">{details.subject.bannerBody || details.subject.description || "تعلّم بخطوات واضحة، من الوحدة الأولى حتى آخر إنجاز."}</p>
        {identity.role === "student" && <Link href={`/app/student/subjects/${details.subject.id}/journey`} className="focus-ring mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#ffd64a] px-5 font-black text-[#170b35]"><Compass className="size-5"/> ابدأ رحلة التعلّم</Link>}
        {editable && details.subject.status !== "published" && <ActionForm action={publishLearningSubjectAction} className="mt-6"><input type="hidden" name="subjectId" value={details.subject.id}/><Button className="bg-[#ffd64a] text-[#170b35] hover:bg-[#f3c83c]">نشر المادة للطلاب</Button></ActionForm>}
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="metric-card"><Users/><span><strong>{details.groups.length}</strong><small>{identity.role === "student" ? "مجموعتي" : "المجموعات"}</small></span></div>
      <div className="metric-card"><Layers3/><span><strong>{details.units.length}</strong><small>الوحدات</small></span></div>
      <div className="metric-card"><BookOpen/><span><strong>{details.lessons.length}</strong><small>الدروس</small></span></div>
    </div>

    {editable && <SubjectAuthoringToolbar subject={details.subject} groups={details.groups}/>}

    {editable && details.groups.length > 0 && <section className="grid gap-3">
      <div><h2 className="font-heading text-2xl font-bold">مجموعات المادة</h2><p className="mt-1 text-sm text-[var(--muted)]">كل طالب يرى محتوى مجموعته داخل هذه المادة فقط.</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{details.groups.map((group) => <Card key={group.id} className="p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--soft)] text-[var(--brand)]"><Users className="size-5"/></span><span><CardTitle className="text-base">{group.name}</CardTitle><CardDescription>{group.description || "مجموعة نشطة"}</CardDescription></span></div></Card>)}</div>
    </section>}

    <section className="grid gap-4">
      <div><h2 className="font-heading text-2xl font-bold">الوحدات والدروس</h2><p className="mt-1 text-sm text-[var(--muted)]">محتوى مرتب يسهل على الطالب متابعة مكانه.</p></div>
      {details.units.length ? details.units.map((unit, unitIndex) => {
        const lessons = lessonsByUnit.get(unit.id) ?? [];
        return <Card key={unit.id} className="overflow-hidden p-0">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] p-5">
            <div><span className="text-xs font-bold text-[var(--accent)]">الوحدة {unitIndex + 1}</span><CardTitle className="mt-1">{unit.title}</CardTitle><CardDescription>{unit.description || "وحدة تعليمية مرتبة"}</CardDescription></div>
            <div className="flex items-center gap-2"><span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-bold">{lessons.length} دروس</span>{editable && unit.status !== "published" && <ActionForm action={publishLearningUnitAction}><input type="hidden" name="unitId" value={unit.id}/><Button size="sm" variant="secondary">نشر الوحدة</Button></ActionForm>}</div>
          </div>
          <div className="grid gap-2 p-4">
            {lessons.length ? lessons.map((lesson, lessonIndex) => <div key={lesson.id} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--soft)] text-sm font-black text-[var(--brand)]">{lessonIndex + 1}</span><span className="min-w-0"><strong className="block truncate">{lesson.title}</strong><small className="text-[var(--muted)]">{lesson.status === "published" ? "متاح" : "قيد الإعداد"}</small></span></span>
              {identity.role === "student" ? <Link className="focus-ring rounded-xl p-3 text-[var(--brand)]" href={`/app/student/subjects/${details.subject.id}/journey?lesson=${lesson.id}`} aria-label={`فتح ${lesson.title}`}><ChevronLeft className="size-5"/></Link> : <span className="flex flex-wrap items-center justify-end gap-2">{identity.role === "teacher" && <Link href={`/app/teacher/lessons/${lesson.id}/edit`} className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-3 text-xs font-black hover:bg-[var(--soft)]">إدارة المحتوى</Link>}{editable && lesson.status !== "published" ? <ActionForm action={publishLearningLessonAction}><input type="hidden" name="lessonId" value={lesson.id}/><Button size="sm" variant="secondary">نشر الدرس</Button></ActionForm> : <span className="text-xs font-bold text-[var(--accent)]">{lesson.status === "published" ? "منشور" : "مسودة"}</span>}</span>}
            </div>) : <EmptyState title="لا توجد دروس في هذه الوحدة"/>}
          </div>
          {editable && <ActionForm action={createLearningLessonAction} className="grid gap-3 border-t border-[var(--border)] bg-[var(--canvas)] p-4 sm:grid-cols-[1fr_180px_auto]">
            <input type="hidden" name="unitId" value={unit.id}/><Input name="title" required placeholder="عنوان الدرس"/><Select name="structureMode" defaultValue="direct"><option value="direct">درس مباشر</option><option value="parts">درس بأجزاء</option></Select><Button><Plus className="size-4"/> إضافة درس</Button>
          </ActionForm>}
        </Card>;
      }) : <EmptyState title="لا توجد وحدات بعد" description={editable ? "أضف الوحدة الأولى من أدوات الإدارة." : "لم ينشر المعلم وحدات بعد."}/>} 
    </section>

  </div>;
}
