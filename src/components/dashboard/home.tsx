import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, FileText, School } from "lucide-react";
import type { CurriculumGrade, LearningSubject } from "@/domain/core-models";
import type { DashboardSummary, Identity } from "@/domain/models";
import { AnnouncementCarousel } from "@/components/announcements/carousel";
import { SubjectGallery } from "@/components/learning/subject-gallery";
import { StatGrid } from "./stat-grid";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { subjectCoverPath } from "@/lib/subject-covers";
import { GradeGallery } from "@/components/learning/grade-gallery";

function StudentHome({ identity, summary, subjects, grades }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[]; grades: CurriculumGrade[] }) {
  const first = subjects[0];
  return (
    <div className="grid gap-6">
      <header className="dashboard-heading student-heading">
        <h1 className="font-heading text-3xl font-bold">أهلًا يا {identity.displayName.split(" ")[0]}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">خطوة صغيرة اليوم تصنع فرقًا كبيرًا.</p>
      </header>
      {first ? (
        <Link href={`/app/student/subjects/${first.id}/journey`} className="focus-ring group grid min-h-[220px] overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-[1fr_280px]">
          <div className="flex flex-col items-start justify-center p-7">
            <span className="text-xs font-bold text-[var(--accent)]">مساحة تعلّمك</span>
            <h2 className="font-heading mt-2 text-2xl font-bold">{first.bannerTitle || first.title}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{first.bannerBody || first.description || "رحلتك التعليمية جاهزة للمتابعة."}</p>
            <span className="mt-5 inline-flex items-center gap-2 font-bold text-[var(--brand)]">فتح الرحلة <ArrowLeft className="size-4 transition group-hover:-translate-x-1" /></span>
          </div>
          <div className="relative min-h-48 bg-[#2b1459]">
            <Image src={subjectCoverPath(first)} alt="" fill priority sizes="280px" className="object-cover" />
          </div>
        </Link>
      ) : (
        <EmptyState title="لا توجد مواد مسجلة" description="ستظهر موادك بعد أن يسجلك المعلم في مجموعته." />
      )}
      <section className="grid gap-4">
        <h2 className="font-heading text-2xl font-bold">موادي</h2>
        <SubjectGallery identity={identity} subjects={subjects.slice(0, 3)} />
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold">صفوفي</h2>
          <Link className="text-sm font-bold text-[var(--brand)]" href="/app/student/grades">عرض الكل</Link>
        </div>
        <GradeGallery identity={identity} grades={grades.slice(0, 3)} subjects={subjects} />
      </section>
      <AnnouncementCarousel items={summary.announcements} />
    </div>
  );
}

function TeacherHome({ identity, summary, subjects, grades }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[]; grades: CurriculumGrade[] }) {
  return (
    <div className="grid gap-6">
      <header className="dashboard-heading teacher-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-sm font-bold text-[var(--accent)]">مساحة المعلم</span>
          <h1 className="font-heading mt-1 text-3xl font-bold">مرحبًا، {identity.displayName}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">أنشئ المحتوى، انشره، وتابع رحلة طلابك من مكان واحد.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/app/teacher/grades">إدارة صفوفي</LinkButton>
          <LinkButton href="/app/teacher/students" variant="secondary">طلابي</LinkButton>
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card"><School /><span><strong>{grades.length}</strong><small>الصفوف</small></span></div>
        <div className="metric-card"><BookOpen /><span><strong>{subjects.length}</strong><small>المواد</small></span></div>
        <div className="metric-card"><CheckCircle2 /><span><strong>{subjects.filter((subject) => subject.status === "published").length}</strong><small>مواد منشورة</small></span></div>
      </div>
      <section className="grid gap-4">
        <h2 className="font-heading text-2xl font-bold">موادي</h2>
        <SubjectGallery identity={identity} subjects={subjects.slice(0, 3)} />
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold">صفوفي</h2>
          <Link className="text-sm font-bold text-[var(--brand)]" href="/app/teacher/grades">عرض الكل</Link>
        </div>
        <GradeGallery identity={identity} grades={grades.slice(0, 3)} subjects={subjects} />
      </section>
      <AnnouncementCarousel items={summary.announcements} />
      <Card>
        <CardTitle>ابدأ من هنا</CardTitle>
        <CardDescription>كل ما تحتاجه لتجهيز درسك القادم ومتابعة طلابك.</CardDescription>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <LinkButton href="/app/teacher/grades" variant="secondary">إدارة الصفوف والمواد</LinkButton>
          <LinkButton href="/app/teacher/students" variant="secondary">إدارة الطلاب</LinkButton>
          <LinkButton href="/app/teacher/announcements" variant="secondary">الإعلانات</LinkButton>
        </div>
      </Card>
    </div>
  );
}

function AdminHome({ identity, summary, subjects }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[] }) {
  const published = subjects.filter((subject) => subject.status === "published").length;
  const drafts = subjects.length - published;
  const counts = summary.counts.filter((item) => item.href !== "/app/admin/groups");
  const lessons = summary.latestLessons.slice(0, 5);
  return (
    <div className="grid gap-6">
      <header className="dashboard-heading admin-heading">
        <span className="text-sm font-bold text-[var(--accent)]">لوحة الإدارة</span>
        <h1 className="font-heading mt-1 text-3xl font-bold">مرحبًا، {identity.displayName}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">نظرة مركزة على المنصة وما يحتاج تدخلك.</p>
      </header>
      <section className="grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 card-shadow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-bold">نظرة تشغيلية</h2>
              <p className="mt-1 text-sm leading-7 text-[var(--muted)]">{subjects.length} مادة على المنصة · {published} منشورة · {drafts} قيد الإعداد</p>
            </div>
            <LinkButton href="/app/admin/subjects" variant="secondary">عرض المواد</LinkButton>
          </div>
          <div className="mt-4">
            <StatGrid items={counts} />
          </div>
        </div>
        <Card>
          <CardTitle>إجراءات سريعة</CardTitle>
          <CardDescription>الوصول المباشر إلى مهام الإدارة اليومية.</CardDescription>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <LinkButton href="/app/admin/teachers" variant="secondary">المعلمون</LinkButton>
            <LinkButton href="/app/admin/students" variant="secondary">الطلاب</LinkButton>
            <LinkButton href="/app/admin/subjects" variant="secondary">المواد</LinkButton>
            <LinkButton href="/app/settings" variant="secondary">الإعدادات</LinkButton>
          </div>
        </Card>
      </section>
      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold">المواد على المنصة</h2>
          <Link className="text-sm font-bold text-[var(--brand)]" href="/app/admin/subjects">عرض الكل</Link>
        </div>
        <SubjectGallery identity={identity} subjects={subjects.slice(0, 3)} />
      </section>
      <Card>
        <CardTitle>أحدث الدروس</CardTitle>
        <CardDescription>آخر الدروس المضافة على المنصة.</CardDescription>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {lessons.length ? lessons.map((lesson) => (
            <Link key={lesson.id} href={`/app/admin/lessons/${lesson.id}`} className="focus-ring flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--soft)] text-[var(--brand)]"><FileText className="size-5" /></span>
                <span className="min-w-0">
                  <strong className="block truncate">{lesson.title}</strong>
                  <small className="text-xs font-bold text-[var(--muted)]">{lesson.status === "published" ? "منشور" : lesson.status === "archived" ? "مؤرشف" : "مسودة"}</small>
                </span>
              </span>
              <ArrowLeft className="size-4 shrink-0 text-[var(--muted)]" />
            </Link>
          )) : <EmptyState title="لا توجد دروس بعد" />}
        </div>
      </Card>
      <AnnouncementCarousel items={summary.announcements} />
    </div>
  );
}

export function DashboardHome({ identity, summary, subjects = [], grades = [] }: { identity: Identity; summary: DashboardSummary; subjects?: LearningSubject[]; grades?: CurriculumGrade[] }) {
  if (identity.role === "student") return <StudentHome identity={identity} summary={summary} subjects={subjects} grades={grades} />;
  if (identity.role === "teacher") return <TeacherHome identity={identity} summary={summary} subjects={subjects} grades={grades} />;
  return <AdminHome identity={identity} summary={summary} subjects={subjects} />;
}
