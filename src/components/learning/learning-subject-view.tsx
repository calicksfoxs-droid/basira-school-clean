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

export function LearningSubjectView({ identity, details }: { identity: Identity; details: LearningSubjectDetails }) {
  const editable = identity.role === "teacher";
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
    {editable && details.groups.length > 0 && <section className="grid gap-3"><div><h2 className="font-heading text-2xl font-bold">مجموعات المادة</h2><p className="mt-1 text-sm text-[var(--muted)]">المجموعة تحدد الطلاب الذين يصلون إلى المادة، وهي منفصلة عن الصف الدراسي.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{details.groups.map((group) => <Card key={group.id} className="p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--soft)] text-[var(--brand)]"><Users className="size-5"/></span><span><CardTitle className="text-base">{group.name}</CardTitle><CardDescription>{group.description || "مجموعة نشطة"}</CardDescription></span></div></Card>)}</div></section>}
    <CurriculumSections identity={identity} details={details}/>
  </div>;
}
