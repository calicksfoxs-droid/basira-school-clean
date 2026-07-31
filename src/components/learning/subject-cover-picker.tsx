"use client";

import Image from "next/image";
import { Check, ImageIcon } from "lucide-react";
import { useState } from "react";
import { updateLearningSubjectCoverAction } from "@/actions/learning-core";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SUBJECT_COVERS, subjectCoverKey, type SubjectCoverKey } from "@/lib/subject-covers";
import type { LearningSubject } from "@/domain/core-models";

export function SubjectCoverPicker({ subject }: { subject: LearningSubject }) {
  const initial = subjectCoverKey(subject);
  const [selected, setSelected] = useState<SubjectCoverKey>(initial);
  const selectedCover = SUBJECT_COVERS.find((cover) => cover.key === selected)!;

  return <div className="grid gap-4">
    <div className="relative h-32 overflow-hidden rounded-2xl bg-[#170b35] sm:h-36">
      <Image src={selectedCover.src} alt={`معاينة غلاف ${selectedCover.label}`} fill loading="eager" sizes="520px" className="object-cover"/>
      <div className="absolute inset-0 bg-gradient-to-t from-[#170b35]/85 via-[#170b35]/10 to-transparent"/>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
        <span><strong className="block">{selectedCover.label}</strong><small className="text-white/70">{selectedCover.description}</small></span>
        <span className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-bold backdrop-blur">معاينة</span>
      </div>
    </div>

    <ActionForm action={updateLearningSubjectCoverAction} className="grid gap-3">
      <input type="hidden" name="subjectId" value={subject.id}/>
      <div className="flex snap-x gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="أغلفة المواد">
        {SUBJECT_COVERS.map((cover) => <label key={cover.key} className={`focus-within:ring-2 focus-within:ring-[var(--brand)] relative min-w-32 snap-start cursor-pointer overflow-hidden rounded-xl border-2 transition ${selected === cover.key ? "border-[var(--brand)]" : "border-[var(--border)] hover:border-[var(--brand)]/55"}`}>
          <input className="sr-only" type="radio" name="coverKey" value={cover.key} checked={selected === cover.key} onChange={() => setSelected(cover.key)}/>
          <span className="relative block h-[68px] bg-[#170b35]"><Image src={cover.src} alt="" fill sizes="128px" className="object-cover"/></span>
          <span className="flex min-h-9 items-center justify-between gap-1 bg-[var(--surface)] px-2 py-1.5 text-[11px] font-black text-[var(--text)]"><span>{cover.label}</span>{selected === cover.key && <Check className="size-3.5 shrink-0 text-[var(--brand)]"/>}</span>
        </label>)}
      </div>
      <Button className="justify-self-start" size="sm" disabled={selected === initial}><ImageIcon className="size-4"/> {selected === initial ? "الغلاف الحالي" : "حفظ الغلاف"}</Button>
    </ActionForm>
  </div>;
}
