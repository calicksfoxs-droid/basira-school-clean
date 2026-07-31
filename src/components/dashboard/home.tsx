import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardCheck, School, Users } from "lucide-react";
import type { LearningSubject } from "@/domain/core-models";
import type { DashboardSummary, Identity } from "@/domain/models";
import { AnnouncementCarousel } from "@/components/announcements/carousel";
import { StatGrid } from "./stat-grid";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { subjectCoverPath } from "@/lib/subject-covers";

function subjectHref(identity: Identity, id: string) { return `/app/${identity.role}/subjects/${id}`; }

function StudentHome({ identity, summary, subjects }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[] }) {
  const first = subjects[0];
  return <div className="grid gap-6">
    <header><h1 className="font-heading text-3xl font-bold">أهلًا يا {identity.displayName.split(" ")[0]} 👋</h1><p className="mt-2 text-sm text-[var(--muted)]">خطوة صغيرة اليوم تصنع فرقًا كبيرًا.</p></header>
    {first ? <Link href={`/app/student/subjects/${first.id}/journey`} className="focus-ring group grid min-h-[220px] overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-start justify-center p-7"><span className="text-xs font-bold text-[var(--accent)]">تابع من حيث توقفت</span><h2 className="font-heading mt-2 text-2xl font-bold">{first.bannerTitle || first.title}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{first.bannerBody || first.description || "رحلتك التعليمية جاهزة للمتابعة."}</p><span className="mt-5 inline-flex items-center gap-2 font-bold text-[var(--brand)]">فتح الرحلة <ArrowLeft className="size-4 transition group-hover:-translate-x-1"/></span></div>
      <div className="relative min-h-48 bg-[#2b1459]"><Image src={subjectCoverPath(first)} alt="" fill priority sizes="280px" className="object-cover"/></div>
    </Link> : <EmptyState title="لا توجد مواد مسجلة" description="ستظهر موادك بعد أن يسجلك المعلم في مجموعته."/>}
    <section><div className="mb-4 flex items-center justify-between"><h2 className="font-heading text-2xl font-bold">موادي</h2><Link className="text-sm font-bold text-[var(--brand)]" href="/app/student/subjects">عرض الكل</Link></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{subjects.slice(0,3).map((subject, index) => <Link key={subject.id} href={subjectHref(identity, subject.id)} className="focus-ring rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5"><span className="text-xs font-bold text-[var(--accent)]">المادة {index + 1}</span><h3 className="font-heading mt-2 text-lg font-bold">{subject.title}</h3><p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{subject.description || "محتوى ودروس مرتبة"}</p><span className="mt-5 block text-sm font-bold text-[var(--brand)]">فتح المادة ←</span></Link>)}</div></section>
    <AnnouncementCarousel items={summary.announcements}/>
  </div>;
}

function TeacherHome({ identity, summary, subjects }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[] }) {
  return <div className="grid gap-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-sm font-bold text-[var(--accent)]">مساحة المعلم</span><h1 className="font-heading mt-1 text-3xl font-bold">مرحبًا، {identity.displayName}</h1><p className="mt-2 text-sm text-[var(--muted)]">موادك ومجموعاتك وما يحتاج إلى متابعة.</p></div><LinkButton href="/app/teacher/subjects">إدارة موادي</LinkButton></header><div className="grid gap-4 sm:grid-cols-3"><div className="metric-card"><BookOpen/><span><strong>{subjects.length}</strong><small>المواد</small></span></div><div className="metric-card"><School/><span><strong>{summary.groups.length}</strong><small>المجموعات</small></span></div><div className="metric-card"><ClipboardCheck/><span><strong>{summary.pendingSubmissions.length}</strong><small>تحتاج تصحيحًا</small></span></div></div><AnnouncementCarousel items={summary.announcements}/><section className="grid gap-5 xl:grid-cols-[1fr_360px]"><Card><CardTitle>موادك الحديثة</CardTitle><CardDescription>ابدأ بالمادة التي تريد تحديثها.</CardDescription><div className="mt-5 grid gap-3">{subjects.length ? subjects.slice(0,5).map((subject) => <Link key={subject.id} href={subjectHref(identity, subject.id)} className="focus-ring flex min-h-16 items-center justify-between rounded-2xl border border-[var(--border)] px-4"><span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--soft)] text-[var(--brand)]"><BookOpen className="size-5"/></span><strong>{subject.title}</strong></span><ArrowLeft className="size-4 text-[var(--muted)]"/></Link>) : <EmptyState title="لا توجد مواد بعد"/>}</div></Card><Card><CardTitle>تحتاج انتباهك</CardTitle><CardDescription>تسليمات تنتظر المراجعة.</CardDescription><div className="mt-5 grid gap-3">{summary.pendingSubmissions.length ? summary.pendingSubmissions.slice(0,5).map((submission) => <Link key={submission.id} href={`/app/teacher/submissions/${submission.id}`} className="focus-ring flex items-center gap-3 rounded-xl border border-[var(--border)] p-4"><ClipboardCheck className="size-5 text-amber-600"/><span className="font-bold">تسليم قيد التصحيح</span></Link>) : <EmptyState title="كل شيء مراجع"/>}</div></Card></section></div>;
}

function AdminHome({ identity, summary, subjects }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[] }) {
  return <div className="grid gap-6"><header><span className="text-sm font-bold text-[var(--accent)]">لوحة الإدارة</span><h1 className="font-heading mt-1 text-3xl font-bold">صباح الخير، {identity.displayName}</h1><p className="mt-2 text-sm text-[var(--muted)]">نظرة مركزة على المنصة وما يحتاج تدخلك.</p></header><StatGrid items={summary.counts}/><div className="grid gap-4 sm:grid-cols-3"><div className="metric-card"><BookOpen/><span><strong>{subjects.length}</strong><small>المواد</small></span></div><div className="metric-card"><Users/><span><strong>{summary.groups.length}</strong><small>المجموعات</small></span></div><div className="metric-card"><CheckCircle2/><span><strong>{summary.latestLessons.length}</strong><small>دروس حديثة</small></span></div></div><AnnouncementCarousel items={summary.announcements}/><section className="grid gap-5 xl:grid-cols-2"><Card><CardTitle>المواد على المنصة</CardTitle><CardDescription>أحدث المواد المنشأة بواسطة المعلمين.</CardDescription><div className="mt-5 grid gap-3">{subjects.slice(0,5).map((subject) => <Link key={subject.id} href={`/app/admin/subjects/${subject.id}`} className="focus-ring flex items-center justify-between rounded-xl border border-[var(--border)] p-4"><strong>{subject.title}</strong><ArrowLeft className="size-4"/></Link>)}</div></Card><Card><CardTitle>اختصارات الإدارة</CardTitle><div className="mt-5 grid gap-3 sm:grid-cols-2"><LinkButton href="/app/admin/teachers" variant="secondary">المعلمون</LinkButton><LinkButton href="/app/admin/students" variant="secondary">الطلاب</LinkButton><LinkButton href="/app/admin/subjects" variant="secondary">المواد</LinkButton><LinkButton href="/app/settings" variant="secondary">الإعدادات</LinkButton></div></Card></section></div>;
}

export function DashboardHome({ identity, summary, subjects = [] }: { identity: Identity; summary: DashboardSummary; subjects?: LearningSubject[] }) {
  if (identity.role === "student") return <StudentHome identity={identity} summary={summary} subjects={subjects}/>;
  if (identity.role === "teacher") return <TeacherHome identity={identity} summary={summary} subjects={subjects}/>;
  return <AdminHome identity={identity} summary={summary} subjects={subjects}/>;
}
