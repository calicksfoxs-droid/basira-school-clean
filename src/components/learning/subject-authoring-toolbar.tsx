"use client";

import { BookPlus, ImageIcon, Megaphone, Plus, UserPlus, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createLearningGroupAction,
  createLearningUnitAction,
  enrollExistingStudentAction,
  updateLearningSubjectBannerAction,
} from "@/actions/learning-core";
import { SubjectCoverPicker } from "@/components/learning/subject-cover-picker";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { LearningSubject, SubjectGroup } from "@/domain/core-models";

type Panel = "unit" | "group" | "student" | "appearance";

const panelCopy: Record<Panel, { title: string; description: string }> = {
  unit: { title: "إضافة وحدة جديدة", description: "ابدأ ببناء محتوى المادة، ثم أضف الدروس من بطاقة الوحدة." },
  group: { title: "مجموعة جديدة", description: "حدّد مجموعة الطلاب التي ستصل إلى هذه المادة." },
  student: { title: "تسجيل طالب موجود", description: "أضف الطالب إلى إحدى مجموعات المادة باستخدام معرّف الانضمام." },
  appearance: { title: "تخصيص واجهة المادة", description: "تعديلات شكلية خفيفة لا تعطل بناء المحتوى." },
};

export function SubjectAuthoringToolbar({ subject, groups }: { subject: LearningSubject; groups: SubjectGroup[] }) {
  const [panel, setPanel] = useState<Panel | null>(null);

  useEffect(() => {
    if (!panel) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setPanel(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [panel]);

  return <>
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm" aria-label="أدوات المادة">
      <div className="hidden px-2 sm:block"><strong className="block text-sm">أدوات المادة</strong><small className="text-[var(--muted)]">أضف المحتوى، ثم نظّم الوصول.</small></div>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        <button onClick={() => setPanel("unit")} className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-black text-white transition hover:brightness-95 sm:flex-none"><BookPlus className="size-4"/> إضافة وحدة</button>
        <button onClick={() => setPanel("group")} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--soft)]"><Users className="size-4 text-[var(--brand)]"/> مجموعة جديدة</button>
        <button onClick={() => setPanel("student")} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]"><UserPlus className="size-4"/> تسجيل طالب</button>
        <button onClick={() => setPanel("appearance")} className="focus-ring grid size-11 place-items-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]" aria-label="تخصيص المظهر" title="الغلاف وإعلان المادة"><ImageIcon className="size-5"/></button>
      </div>
    </section>

    {panel && <div className="fixed inset-0 z-[80]" role="presentation">
      <button className="absolute inset-0 bg-[#0a1020]/65 backdrop-blur-[2px]" onClick={() => setPanel(null)} aria-label="إغلاق اللوحة"/>
      <aside role="dialog" aria-modal="true" aria-labelledby="subject-panel-title" className="absolute inset-y-0 left-0 w-[min(94vw,500px)] overflow-y-auto border-r border-[var(--border)] bg-[var(--canvas)] shadow-2xl" dir="rtl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--canvas)]/95 p-5 backdrop-blur">
          <div><h2 id="subject-panel-title" className="font-heading text-xl font-bold">{panelCopy[panel].title}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{panelCopy[panel].description}</p></div>
          <button onClick={() => setPanel(null)} className="focus-ring grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)]" aria-label="إغلاق اللوحة"><X className="size-5"/></button>
        </header>
        <div className="p-5 sm:p-6">
          {panel === "unit" && <ActionForm action={createLearningUnitAction} className="grid gap-4"><input type="hidden" name="subjectId" value={subject.id}/><Field label="اسم الوحدة"><Input name="title" required autoFocus placeholder="مثال: الحركة والقوى"/></Field><Field label="وصف مختصر"><Textarea name="description" placeholder="ما الذي سيتعلمه الطالب في هذه الوحدة؟"/></Field><Button><Plus className="size-4"/> إنشاء الوحدة</Button></ActionForm>}

          {panel === "group" && <ActionForm action={createLearningGroupAction} className="grid gap-4"><input type="hidden" name="subjectId" value={subject.id}/><Field label="اسم المجموعة"><Input name="name" required autoFocus placeholder="مثال: الصف الثالث — المجموعة أ"/></Field><Field label="الوصف"><Textarea name="description" placeholder="وصف اختياري يساعدك على تمييز المجموعة"/></Field><Button><Users className="size-4"/> إنشاء المجموعة</Button></ActionForm>}

          {panel === "student" && (groups.length ? <ActionForm action={enrollExistingStudentAction} className="grid gap-4"><Field label="المجموعة"><Select name="groupId" required autoFocus>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field><Field label="معرّف الانضمام"><Input name="enrollmentReference" required dir="ltr" placeholder="BSR-S-XXXXXXXXXXXX"/></Field><p className="text-xs leading-6 text-[var(--muted)]">استخدم معرّف الانضمام الخاص بالطالب، وليس رمز دخوله.</p><Button><UserPlus className="size-4"/> إضافة الطالب للمجموعة</Button></ActionForm> : <div className="grid gap-4"><EmptyState title="أنشئ مجموعة أولًا" description="لا يمكن تسجيل طالب في المادة قبل وجود مجموعة."/><Button onClick={() => setPanel("group")} variant="secondary">إنشاء مجموعة الآن</Button></div>)}

          {panel === "appearance" && <div className="grid gap-6">
            <section><div className="mb-3 flex items-center gap-2"><ImageIcon className="size-5 text-[var(--brand)]"/><h3 className="font-heading font-bold">غلاف المادة</h3></div><SubjectCoverPicker subject={subject}/></section>
            <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl font-bold"><span className="inline-flex items-center gap-2"><Megaphone className="size-4 text-[var(--brand)]"/> نص واجهة المادة</span><Plus className="size-4 transition group-open:rotate-45"/></summary>
              <ActionForm action={updateLearningSubjectBannerAction} className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5"><input type="hidden" name="subjectId" value={subject.id}/><Field label="عنوان الإعلان"><Input name="title" defaultValue={subject.bannerTitle}/></Field><Field label="النص"><Textarea name="body" defaultValue={subject.bannerBody}/></Field><Button><Megaphone className="size-4"/> حفظ النص</Button></ActionForm>
            </details>
          </div>}
        </div>
      </aside>
    </div>}
  </>;
}
