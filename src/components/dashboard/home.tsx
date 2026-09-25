import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  BookOpen,
  Check,
  ChevronLeft,
  CircleDot,
  ClipboardCheck,
  FileText,
  FlaskConical,
  GraduationCap,
  LockKeyhole,
  Megaphone,
  Orbit,
  Play,
  School,
  Settings2,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import type { CurriculumGrade, LearningJourneyNode, LearningSubject } from "@/domain/core-models";
import type { Announcement, DashboardSummary, Identity } from "@/domain/models";
import { EmptyState } from "@/components/ui/empty-state";
import { subjectTheme, subjectThemeMeta, teacherTheme, type BasiraSubjectTheme } from "@/lib/ui-themes";

function subjectHref(identity: Identity, id: string) {
  return `/app/${identity.role}/subjects/${id}`;
}

function ThemeIcon({ theme, className = "size-5" }: { theme: BasiraSubjectTheme; className?: string }) {
  if (theme === "chemistry") return <FlaskConical className={className}/>;
  if (theme === "physics") return <Orbit className={className}/>;
  return <BookOpen className={className}/>;
}

function SubjectArt({ theme }: { theme: BasiraSubjectTheme }) {
  return <div className={`subject-theme-${theme} science-art relative min-h-28 overflow-hidden rounded-lg border border-[var(--subject-border)] bg-[var(--subject-tint)]`}>
    <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(90deg, transparent 49%, color-mix(in srgb, var(--subject-primary) 13%, transparent) 50%, transparent 51%), linear-gradient(0deg, transparent 49%, color-mix(in srgb, var(--subject-primary) 9%, transparent) 50%, transparent 51%)", backgroundSize: "32px 32px" }}/>
    <div className="relative z-10 flex h-full min-h-28 items-end justify-between p-4">
      <span className="grid size-11 place-items-center rounded-md border border-[var(--subject-border)] bg-[var(--surface)] text-[var(--subject-primary)]"><ThemeIcon theme={theme}/></span>
      <span className="font-heading text-2xl font-bold text-[var(--subject-primary)]">{subjectThemeMeta[theme].label}</span>
    </div>
  </div>;
}

function AnnouncementList({ items }: { items: Announcement[] }) {
  if (!items.length) return <div className="stitch-panel p-5"><p className="text-sm font-semibold">لا توجد إعلانات جديدة</p><p className="mt-1 text-xs leading-6 text-[var(--muted)]">ستظهر هنا آخر التنبيهات المرتبطة بحسابك.</p></div>;
  return <div className="grid gap-2">{items.slice(0, 3).map((item) => <div key={item.id} className="stitch-panel flex items-start gap-3 p-4"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-[var(--soft)] text-[var(--brand)]"><Megaphone className="size-4"/></span><div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-6 text-[var(--muted)]">{item.body}</p></div></div>)}</div>;
}

function JourneyPreview({ journey, theme = "core" }: { journey: LearningJourneyNode[]; theme?: BasiraSubjectTheme }) {
  if (!journey.length) return <div className="stitch-recessed p-4 text-sm text-[var(--muted)]">يظهر مسار التعلم بعد نشر أول دروس المادة.</div>;
  const visible = journey.slice(0, 6);
  return <div className={`subject-theme-${theme} stitch-recessed p-4`}>
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1" dir="rtl">
      {visible.map((node, index) => <div key={node.lessonId} className="flex min-w-0 flex-1 items-center">
        <div className={`relative z-10 grid shrink-0 place-items-center rounded-full border ${node.state === "completed" ? "size-8 border-[var(--subject-primary)] bg-[var(--subject-primary)] text-white" : node.state === "available" ? "journey-node-current size-10 border-2 border-[var(--subject-primary)] bg-[var(--surface)] text-[var(--subject-primary)]" : "size-7 border-[var(--border)] bg-[var(--soft)] text-[var(--muted)]"}`}>
          {node.state === "completed" ? <Check className="size-4"/> : node.state === "locked" ? <LockKeyhole className="size-3.5"/> : <span className="text-xs font-bold">{node.order}</span>}
        </div>
        {index < visible.length - 1 && <span className={`h-0.5 min-w-5 flex-1 ${node.state === "completed" ? "bg-[var(--subject-primary)]" : "bg-[var(--border)]"}`}/>}
      </div>)}
    </div>
    <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[var(--muted)]"><span>{journey.filter((node) => node.state === "completed").length} مكتمل</span><span>{journey.filter((node) => node.state === "available").length} متاح الآن</span><span>{journey.filter((node) => node.state === "locked").length} مقفل</span></div>
  </div>;
}

function SubjectCard({ identity, subject }: { identity: Identity; subject: LearningSubject }) {
  const theme = subjectTheme(subject);
  return <Link href={subjectHref(identity, subject.id)} className={`subject-theme-${theme} stitch-panel focus-ring group grid overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-10px_rgba(23,27,46,.16)]`}>
    <SubjectArt theme={theme}/>
    <div className="p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{subject.title}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{subject.description || "مسار تعلّم منظم داخل بصيرة"}</p></div><ChevronLeft className="size-4 shrink-0 text-[var(--subject-primary)] transition group-hover:-translate-x-1"/></div></div>
  </Link>;
}

function StudentHome({ identity, summary, subjects, grades, journey }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[]; grades: CurriculumGrade[]; journey: LearningJourneyNode[] }) {
  const first = subjects[0];
  const firstTheme = subjectTheme(first);
  const completed = journey.filter((node) => node.state === "completed").length;
  const progress = journey.length ? Math.round((completed / journey.length) * 100) : 0;
  const nextLesson = summary.latestLessons[0];

  return <div className="grid gap-5 sm:gap-6">
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="stitch-eyebrow">STUDENT / بصيرة</p><h1 className="font-heading mt-2 text-2xl font-bold sm:text-3xl">مرحبًا، {identity.displayName.split(" ")[0]}</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">تابع مسارك من النقطة الصحيحة، وشاهد ما أنجزته وما ينتظرك بعدها.</p></div>
      <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]"><School className="size-4 text-[var(--brand)]"/><span>{grades[0]?.title || "المسار الدراسي"}</span></div>
    </section>

    {first ? <section className={`subject-theme-${firstTheme} grid gap-4 xl:grid-cols-[1.45fr_.8fr]`}>
      <div className="science-art relative overflow-hidden rounded-lg border border-[var(--subject-border)] bg-[var(--subject-tint)] p-5 sm:p-7">
        <div className="relative z-10 max-w-2xl"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-md bg-[var(--surface)] text-[var(--subject-primary)]"><ThemeIcon theme={firstTheme} className="size-4.5"/></span><span className="text-xs font-semibold tracking-[.04em] text-[var(--subject-primary)]">أكمل تعلمك</span></div><h2 className="font-heading mt-5 text-2xl font-bold leading-[1.55] sm:text-[2rem]">{nextLesson?.title || first.bannerTitle || first.title}</h2><p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{first.bannerBody || first.description || "الدرس التالي جاهز للمتابعة داخل مسارك."}</p><div className="mt-6 flex flex-wrap gap-2"><Link href={`/app/student/subjects/${first.id}/journey`} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--subject-primary)] px-4 text-sm font-semibold text-white"><Play className="size-4"/>استكمال المسار</Link><Link href={subjectHref(identity, first.id)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--subject-border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--subject-primary)]"><BookOpen className="size-4"/>فتح المادة</Link></div></div>
      </div>
      <div className="stitch-panel p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-[var(--muted)]">إنجاز المسار</p><p className="font-heading mt-1 text-3xl font-bold">{progress}%</p></div><span className="grid size-11 place-items-center rounded-full bg-[var(--subject-tint)] text-[var(--subject-primary)]"><Sparkles className="size-5"/></span></div><div className="mt-5"><JourneyPreview journey={journey} theme={firstTheme}/></div></div>
    </section> : <EmptyState title="لا توجد مواد مسجلة" description="ستظهر موادك بعد تسجيلك في إحدى مجموعات التعلم."/>}

    <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <div><div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-lg font-bold">موادي الدراسية</h2><Link href="/app/student/grades" className="text-xs font-semibold text-[var(--brand)]">عرض الكل</Link></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{subjects.slice(0, 3).map((subject) => <SubjectCard key={subject.id} identity={identity} subject={subject}/>)}</div></div>
      <div><div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-lg font-bold">آخر النتائج</h2><Link href="/app/student/results" className="text-xs font-semibold text-[var(--brand)]">كل النتائج</Link></div><div className="stitch-panel p-5">{summary.releasedSubmissions[0] ? <><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-md bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]"><ClipboardCheck className="size-5"/></span><strong className="text-2xl">{summary.releasedSubmissions[0].totalScore}</strong></div><p className="mt-4 text-sm font-semibold">أحدث اختبار مصحح</p><p className="mt-1 text-xs text-[var(--muted)]">تم إصدار النتيجة ويمكن فتح التفاصيل الآن.</p></> : <><span className="grid size-10 place-items-center rounded-md bg-[var(--soft)] text-[var(--muted)]"><ClipboardCheck className="size-5"/></span><p className="mt-4 text-sm font-semibold">لا توجد نتائج بعد</p><p className="mt-1 text-xs text-[var(--muted)]">ستظهر نتيجة أول اختبار مكتمل هنا.</p></>}</div></div>
    </section>

    <section><div className="mb-3 flex items-center gap-2"><BellRing className="size-4 text-[var(--brand)]"/><h2 className="font-heading text-lg font-bold">آخر الإعلانات</h2></div><AnnouncementList items={summary.announcements}/></section>
  </div>;
}

function TeacherHome({ identity, summary, subjects, grades }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[]; grades: CurriculumGrade[] }) {
  const theme = teacherTheme(subjects);
  const meta = subjectThemeMeta[theme];
  const primary = subjects.find((subject) => subjectTheme(subject) === theme) ?? subjects[0];
  const latest = summary.latestLessons[0];
  const studentCount = summary.counts.find((item) => item.label.includes("طلاب"))?.value ?? 0;

  return <div className={`subject-theme-${theme} grid gap-5 sm:gap-6`}>
    <section className="science-art relative overflow-hidden rounded-lg border border-[var(--subject-border)] bg-[var(--subject-tint)] p-5 sm:p-7">
      <div className="relative z-10 max-w-3xl"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--subject-primary)]"><ThemeIcon theme={theme} className="size-4"/>{meta.eyebrow}</span><span className="text-xs text-[var(--muted)]">{grades[0]?.title || "مساحة المعلم"}</span></div><h1 className="font-heading mt-5 text-2xl font-bold leading-[1.5] sm:text-[2rem]">{theme === "chemistry" ? "لوحة معلم الكيمياء" : theme === "physics" ? "لوحة معلم الفيزياء" : "مساحة المعلم"}</h1><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{identity.displayName} • {primary?.title || "المادة التعليمية"}</p><div className="mt-6 flex flex-wrap gap-2">{primary && <Link href={subjectHref(identity, primary.id)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--subject-primary)] px-4 text-sm font-semibold text-white"><Settings2 className="size-4"/>فتح مساحة المادة</Link>}<Link href="/app/teacher/students" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--subject-border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--subject-primary)]"><Users className="size-4"/>إدارة الطلاب</Link></div></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-3">
      <div className="stitch-panel p-4"><div className="flex items-center justify-between"><span className="text-xs text-[var(--muted)]">الطلاب</span><Users className="size-4 text-[var(--subject-primary)]"/></div><strong className="font-heading mt-3 block text-2xl">{studentCount}</strong><span className="text-xs text-[var(--muted)]">ضمن مجموعاتك الحالية</span></div>
      <div className="stitch-panel p-4"><div className="flex items-center justify-between"><span className="text-xs text-[var(--muted)]">المواد</span><BookOpen className="size-4 text-[var(--subject-primary)]"/></div><strong className="font-heading mt-3 block text-2xl">{subjects.length}</strong><span className="text-xs text-[var(--muted)]">{subjects.filter((subject) => subject.status === "published").length} منشورة</span></div>
      <div className="stitch-panel p-4"><div className="flex items-center justify-between"><span className="text-xs text-[var(--muted)]">الصفوف</span><GraduationCap className="size-4 text-[var(--subject-primary)]"/></div><strong className="font-heading mt-3 block text-2xl">{grades.length}</strong><span className="text-xs text-[var(--muted)]">صفوف مرتبطة بحسابك</span></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="stitch-panel p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="stitch-eyebrow">AUTHORING WORKSPACE</p><h2 className="font-heading mt-2 text-xl font-bold">{latest?.title ? `استكمال: ${latest.title}` : "ابدأ تأليف الدرس التالي"}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">المسار المرئي يربط الوحدة والدرس والملفات والاختبار في مكان واحد.</p></div>{primary && <Link href={subjectHref(identity, primary.id)} className="text-xs font-semibold text-[var(--subject-primary)]">فتح المادة <ArrowLeft className="inline size-3.5"/></Link>}</div><div className="mt-5 grid gap-2 sm:grid-cols-2"><Link href={primary ? subjectHref(identity, primary.id) : "/app/teacher/grades"} className="subject-wash focus-ring flex min-h-24 items-center gap-3 rounded-lg border p-4"><span className="grid size-10 place-items-center rounded-md bg-[var(--surface)] text-[var(--subject-primary)]"><Video className="size-5"/></span><span><strong className="block text-sm">الفيديو والدرس</strong><small className="mt-1 block text-xs text-[var(--muted)]">إدارة محتوى الدرس الحالي</small></span></Link><Link href={primary ? subjectHref(identity, primary.id) : "/app/teacher/grades"} className="focus-ring flex min-h-24 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"><span className="grid size-10 place-items-center rounded-md bg-[var(--soft)] text-[var(--subject-primary)]"><FileText className="size-5"/></span><span><strong className="block text-sm">PDF والاختبار</strong><small className="mt-1 block text-xs text-[var(--muted)]">مصادر الدرس والتقييم الموضوعي</small></span></Link></div></div>
      <div className="stitch-panel p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="font-heading text-lg font-bold">المسار المنهجي</h2><CircleDot className="size-4 text-[var(--subject-primary)]"/></div><div className="mt-5 grid gap-0">{["المادة","الوحدة","الدرس","الملفات","الاختبار","النشر"].map((label,index) => <div key={label} className="flex items-center gap-3"><span className={`grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${index < 3 ? "border-[var(--subject-primary)] bg-[var(--subject-primary)] text-white" : index === 3 ? "journey-node-current border-2 border-[var(--subject-primary)] bg-[var(--surface)] text-[var(--subject-primary)]" : "border-[var(--border)] bg-[var(--soft)] text-[var(--muted)]"}`}>{index < 3 ? <Check className="size-3.5"/> : index + 1}</span><div className="flex min-h-12 flex-1 items-center border-b border-[var(--border)] text-sm"><span>{label}</span></div></div>)}</div></div>
    </section>

    <section><div className="mb-3 flex items-center gap-2"><Megaphone className="size-4 text-[var(--subject-primary)]"/><h2 className="font-heading text-lg font-bold">الإعلانات</h2></div><AnnouncementList items={summary.announcements}/></section>
  </div>;
}

function AdminHome({ identity, summary, subjects }: { identity: Identity; summary: DashboardSummary; subjects: LearningSubject[] }) {
  const cards = summary.counts.filter((item) => item.href !== "/app/admin/groups").slice(0, 4);
  return <div className="subject-theme-core grid gap-5 sm:gap-6">
    <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="stitch-eyebrow">ADMIN / BASIRA CORE</p><h1 className="font-heading mt-2 text-2xl font-bold sm:text-3xl">لوحة العمليات اليومية</h1><p className="mt-2 text-sm leading-7 text-[var(--muted)]">مرحبًا، {identity.displayName}. إدارة مركزة للمعلمين والطلاب والمواد والإعلانات.</p></div><div className="flex flex-wrap gap-2"><Link href="/app/admin/teachers" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--brand)] px-3.5 text-xs font-semibold text-white"><GraduationCap className="size-4"/>معلم جديد</Link><Link href="/app/admin/subjects" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold"><BookOpen className="size-4"/>إدارة المواد</Link></div></section>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map((item) => <Link key={item.label} href={item.href || "/app/admin"} className="stitch-panel focus-ring p-4 transition hover:-translate-y-0.5"><div className="flex items-center justify-between"><span className="text-xs text-[var(--muted)]">{item.label}</span><School className="size-4 text-[var(--brand)]"/></div><strong className="font-heading mt-3 block text-2xl">{item.value}</strong><span className="mt-1 block text-[11px] text-[var(--muted)]">بيانات فعلية من المنصة</span></Link>)}</section>

    <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <div className="stitch-panel p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="stitch-eyebrow">SUBJECT IDENTITIES</p><h2 className="font-heading mt-2 text-lg font-bold">هويات المواد الحالية</h2></div><Link href="/app/admin/subjects" className="text-xs font-semibold text-[var(--brand)]">إدارة المواد</Link></div><div className="mt-5 grid gap-2">{subjects.slice(0, 5).map((subject) => { const theme=subjectTheme(subject); return <Link key={subject.id} href={subjectHref(identity,subject.id)} className={`subject-theme-${theme} focus-ring flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3.5`}><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--subject-tint)] text-[var(--subject-primary)]"><ThemeIcon theme={theme} className="size-4"/></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{subject.title}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{subjectThemeMeta[theme].eyebrow} • {subject.status === "published" ? "منشورة" : "قيد الإعداد"}</p></div></div><ChevronLeft className="size-4 text-[var(--subject-primary)]"/></Link>; })}{!subjects.length && <p className="text-sm text-[var(--muted)]">لا توجد مواد منشأة بعد.</p>}</div></div>
      <div className="grid gap-4"><div className="stitch-panel p-5"><div className="flex items-center gap-2"><Settings2 className="size-4 text-[var(--brand)]"/><h2 className="font-heading text-lg font-bold">اختصارات الإدارة</h2></div><div className="mt-4 grid grid-cols-2 gap-2"><Link href="/app/admin/teachers" className="focus-ring rounded-md bg-[var(--soft)] p-3 text-center text-xs font-semibold">المعلمون</Link><Link href="/app/admin/students" className="focus-ring rounded-md bg-[var(--soft)] p-3 text-center text-xs font-semibold">الطلاب</Link><Link href="/app/admin/announcements" className="focus-ring rounded-md bg-[var(--soft)] p-3 text-center text-xs font-semibold">الإعلانات</Link><Link href="/app/settings" className="focus-ring rounded-md bg-[var(--soft)] p-3 text-center text-xs font-semibold">الإعدادات</Link></div></div><AnnouncementList items={summary.announcements}/></div>
    </section>
  </div>;
}

export function DashboardHome({ identity, summary, subjects = [], grades = [], journey = [] }: { identity: Identity; summary: DashboardSummary; subjects?: LearningSubject[]; grades?: CurriculumGrade[]; journey?: LearningJourneyNode[] }) {
  if (identity.role === "student") return <StudentHome identity={identity} summary={summary} subjects={subjects} grades={grades} journey={journey}/>;
  if (identity.role === "teacher") return <TeacherHome identity={identity} summary={summary} subjects={subjects} grades={grades}/>;
  return <AdminHome identity={identity} summary={summary} subjects={subjects}/>;
}
