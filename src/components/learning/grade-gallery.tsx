import Link from "next/link";
import { ArrowLeft, BookOpen, School } from "lucide-react";
import type { CurriculumGrade, LearningSubject } from "@/domain/core-models";
import type { Identity } from "@/domain/models";
import { EmptyState } from "@/components/ui/empty-state";

export function GradeGallery({ identity, grades, subjects }: { identity: Identity; grades: CurriculumGrade[]; subjects: LearningSubject[] }) {
  if (!grades.length) return <EmptyState title="لا توجد صفوف بعد" description={identity.role === "teacher" ? "أضف الصفوف التي تدرّسها فقط، ثم أضف المواد داخل كل صف." : "ستظهر الصفوف التي سجّلك معلمك في موادها."}/>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{grades.map((grade, index) => {
    const count = subjects.filter((subject) => subject.gradeId === grade.id).length;
    return <Link key={grade.id} href={`/app/${identity.role}/grades/${grade.id}`} className="focus-ring group min-h-48 overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(23,32,51,.10)]">
      <div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--soft)] text-[var(--brand)]"><School className="size-6"/></span><span className="text-xs font-black text-[var(--accent)]">الصف {index + 1}</span></div>
      <h2 className="font-heading mt-6 text-2xl font-bold">{grade.title}</h2>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{grade.description || "صف دراسي منظم بالمواد والوحدات والدروس"}</p>
      <div className="mt-5 flex items-center justify-between text-sm font-bold"><span className="inline-flex items-center gap-2 text-[var(--muted)]"><BookOpen className="size-4"/>{count} مواد</span><span className="inline-flex items-center gap-1 text-[var(--brand)]">فتح الصف <ArrowLeft className="size-4"/></span></div>
    </Link>;
  })}</div>;
}
