import Image from "next/image";
import Link from "next/link";
import { BookOpen, Compass, Layers3, Users } from "lucide-react";
import type { Identity } from "@/domain/models";
import type { LearningSubjectDetails } from "@/domain/core-models";
import { publishLearningSubjectAction } from "@/actions/learning-core";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SubjectAuthoringToolbar } from "@/components/learning/subject-authoring-toolbar";
import { CurriculumSections } from "@/components/learning/curriculum-sections";
import { subjectCoverPath } from "@/lib/subject-covers";
import { subjectTheme, subjectThemeMeta } from "@/lib/ui-themes";

export function LearningSubjectView({ identity, details }: { identity: Identity; details: LearningSubjectDetails }) {
  const editable = identity.role === "teacher";
  const theme = subjectTheme(details.subject);
  const meta = subjectThemeMeta[theme];
  return <div className={`subject-theme-${theme} grid gap-6`}>
    <section className="science-art relative min-h-[320px] overflow-hidden rounded-lg border border-[var(--subject-border)] bg-[var(--subject-tint)]">
      <Image data-testid="subject-hero-cover" src={subjectCoverPath(details.subject)} alt="" fill priority sizes="(max-width: 1024px) 100vw, 1100px" className="object-cover opacity-25 mix-blend-multiply"/>
      <div className="absolute inset-0 bg-gradient-to-l from-[var(--surface)]/95 via-[var(--surface)]/78 to-transparent"/>
      <div className="relative flex min-h-[320px] max-w-3xl flex-col items-start justify-end p-6 sm:p-9">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold tracking-[.08em] text-[var(--subject-primary)]">{meta.eyebrow}</span><span className="text-xs font-semibold text-[var(--muted)]">{details.subject.status === "published" ? "مادة منشورة" : "مسودة"}</span></div>
        <h1 className="font-heading mt-4 text-3xl font-bold leading-[1.45] sm:text-4xl">{details.subject.bannerTitle || details.subject.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-8 text-[var(--muted)]">{details.subject.bannerBody || details.subject.description || "مسار تعلّم متدرج من الوحدة الأولى حتى آخر درس."}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {identity.role === "student" && <Link href={`/app/student/subjects/${details.subject.id}/journey`} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--subject-primary)] px-4 text-sm font-semibold text-white"><Compass className="size-4"/>فتح مسار التعلم</Link>}
          {editable && details.subject.status !== "published" && <ActionForm action={publishLearningSubjectAction}><input type="hidden" name="subjectId" value={details.subject.id}/><Button className="rounded-md bg-[var(--subject-primary)] hover:brightness-95">نشر المادة للطلاب</Button></ActionForm>}
        </div>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="stitch-panel flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-md bg-[var(--subject-tint)] text-[var(--subject-primary)]"><Users className="size-5"/></span><span><strong className="font-heading block text-2xl">{details.groups.length}</strong><small className="text-xs text-[var(--muted)]">{identity.role === "student" ? "مجموعات مرتبطة" : "المجموعات"}</small></span></div>
      <div className="stitch-panel flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-md bg-[var(--subject-tint)] text-[var(--subject-primary)]"><Layers3 className="size-5"/></span><span><strong className="font-heading block text-2xl">{details.units.length}</strong><small className="text-xs text-[var(--muted)]">الوحدات</small></span></div>
      <div className="stitch-panel flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-md bg-[var(--subject-tint)] text-[var(--subject-primary)]"><BookOpen className="size-5"/></span><span><strong className="font-heading block text-2xl">{details.lessons.length}</strong><small className="text-xs text-[var(--muted)]">الدروس</small></span></div>
    </div>

    {editable && <SubjectAuthoringToolbar subject={details.subject} groups={details.groups}/>}
    {editable && details.groups.length > 0 && <section className="grid gap-3"><div><p className="stitch-eyebrow">LEARNING GROUPS</p><h2 className="font-heading mt-1 text-xl font-bold">مجموعات المادة</h2><p className="mt-1 text-sm text-[var(--muted)]">المجموعة تحدد الطلاب الذين يصلون إلى المادة، وهي منفصلة عن الصف الدراسي.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{details.groups.map((group) => <Card key={group.id} className="rounded-lg p-4 shadow-none"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-md bg-[var(--subject-tint)] text-[var(--subject-primary)]"><Users className="size-5"/></span><span><CardTitle className="text-base">{group.name}</CardTitle><CardDescription>{group.description || "مجموعة نشطة"}</CardDescription></span></div></Card>)}</div></section>}
    <CurriculumSections identity={identity} details={details}/>
  </div>;
}
