import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, Users } from "lucide-react";
import type { Identity } from "@/domain/models";
import type { LearningSubject } from "@/domain/core-models";
import { EmptyState } from "@/components/ui/empty-state";
import { subjectCoverPath } from "@/lib/subject-covers";

function subjectHref(identity: Identity, subjectId: string) {
  return `/app/${identity.role}/subjects/${subjectId}`;
}

export function SubjectGallery({ identity, subjects }: { identity: Identity; subjects: LearningSubject[] }) {
  if (!subjects.length) return <EmptyState title="لا توجد مواد بعد" description={identity.role === "teacher" ? "أنشئ مادتك الأولى، ثم أضف مجموعاتها ووحداتها." : "ستظهر هنا المواد التي سجّلك المعلم فيها."}/>;

  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    {subjects.map((subject, index) => <Link key={subject.id} href={subjectHref(identity, subject.id)} className="focus-ring group overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] transition hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(23,32,51,.10)]">
      <div className="relative aspect-[16/8.7] overflow-hidden bg-[#2b1459]">
        <Image src={subjectCoverPath(subject)} alt="" fill priority={index < 3} sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]"/>
        <span className="absolute right-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-bold text-[#172033]">{subject.status === "published" ? "منشورة" : "مسودة"}</span>
      </div>
      <div className="p-5">
        <h2 className="font-heading text-xl font-bold text-[var(--text)]">{subject.title}</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">{subject.description || "مساحة منظمة للدروس والملفات والاختبارات."}</p>
        <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-sm font-bold text-[var(--brand)]">
          <span className="inline-flex items-center gap-2"><BookOpen className="size-4"/> فتح المادة</span>
          <ArrowLeft className="size-4 transition group-hover:-translate-x-1"/>
        </div>
      </div>
    </Link>)}
  </div>;
}

export function SubjectSummary({ subjects }: { subjects: LearningSubject[] }) {
  const published = subjects.filter((subject) => subject.status === "published").length;
  return <div className="grid gap-3 sm:grid-cols-3">
    <div className="metric-card"><BookOpen/><span><strong>{subjects.length}</strong><small>إجمالي المواد</small></span></div>
    <div className="metric-card"><Users/><span><strong>{published}</strong><small>مواد منشورة</small></span></div>
    <div className="metric-card"><span className="metric-dot"/><span><strong>{subjects.length - published}</strong><small>قيد الإعداد</small></span></div>
  </div>;
}
