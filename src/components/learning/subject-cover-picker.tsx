"use client";

import Image from "next/image";
import { Check, ImageIcon } from "lucide-react";
import { useState } from "react";
import { updateLearningSubjectCoverAction } from "@/actions/learning-core";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SUBJECT_COVERS, subjectCoverKey, type SubjectCoverKey } from "@/lib/subject-covers";
import type { LearningSubject } from "@/domain/core-models";

export function SubjectCoverPicker({ subject }: { subject: LearningSubject }) {
  const initial = subjectCoverKey(subject);
  const [selected, setSelected] = useState<SubjectCoverKey>(initial);
  const selectedCover = SUBJECT_COVERS.find((cover) => cover.key === selected)!;

  return <Card id="subject-cover-picker" className="scroll-mt-24 overflow-hidden p-0 xl:col-span-2">
    <div className="grid lg:grid-cols-[minmax(260px,0.8fr)_1.2fr]">
      <div className="relative min-h-64 overflow-hidden bg-[#170b35]">
        <Image src={selectedCover.src} alt={`معاينة غلاف ${selectedCover.label}`} fill loading="eager" sizes="(max-width: 1024px) 100vw, 420px" className="object-cover"/>
        <div className="absolute inset-0 bg-gradient-to-t from-[#170b35]/80 via-transparent to-transparent"/>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-xs font-bold backdrop-blur"><ImageIcon className="size-4"/> معاينة مباشرة</span>
          <h3 className="font-heading mt-3 text-2xl font-bold">{selectedCover.label}</h3>
          <p className="mt-1 text-sm text-white/75">{selectedCover.description}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <CardTitle>اختيار غلاف المادة</CardTitle>
        <CardDescription>اختر الصورة الأنسب؛ سيظهر الغلاف نفسه في بطاقة المادة وصفحتها ورحلة الطالب.</CardDescription>
        <ActionForm action={updateLearningSubjectCoverAction} className="mt-5 grid gap-4">
          <input type="hidden" name="subjectId" value={subject.id}/>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="أغلفة المواد">
            {SUBJECT_COVERS.map((cover) => <label key={cover.key} className={`focus-within:ring-2 focus-within:ring-[var(--brand)] relative cursor-pointer overflow-hidden rounded-2xl border-2 transition ${selected === cover.key ? "border-[var(--brand)] shadow-md" : "border-[var(--border)] hover:border-[var(--brand)]/55"}`}>
              <input className="sr-only" type="radio" name="coverKey" value={cover.key} checked={selected === cover.key} onChange={() => setSelected(cover.key)}/>
              <span className="relative block aspect-[16/9] bg-[#170b35]"><Image src={cover.src} alt="" fill sizes="160px" className="object-cover"/></span>
              <span className="flex min-h-11 items-center justify-between gap-2 bg-[var(--surface)] px-3 py-2 text-xs font-black text-[var(--text)]"><span>{cover.label}</span>{selected === cover.key && <Check className="size-4 shrink-0 text-[var(--brand)]"/>}</span>
            </label>)}
          </div>
          <Button disabled={selected === initial}><ImageIcon className="size-4"/> {selected === initial ? "الغلاف الحالي" : "حفظ الغلاف الجديد"}</Button>
        </ActionForm>
      </div>
    </div>
  </Card>;
}
