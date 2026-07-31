"use client";

import { useEffect, useState } from "react";
import { Check, HardDrive, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { readTeacherFinanceNote, saveTeacherFinanceNote } from "@/lib/teacher-finance-local";

export function TeacherFinanceNoteEditor({
  teacherId,
  groupId,
  studentId,
}: {
  teacherId: string;
  groupId: string;
  studentId: string;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = readTeacherFinanceNote(teacherId, groupId, studentId);
      setAmount(current?.amount ?? "");
      setNote(current?.note ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [groupId, studentId, teacherId]);

  function save() {
    saveTeacherFinanceNote(teacherId, groupId, studentId, { amount, note });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-3" data-testid="teacher-local-finance">
    <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold text-amber-900">
      <span className="inline-flex items-center gap-1.5"><WalletCards className="size-4"/> متابعة مالية للمعلم</span>
      <span className="inline-flex items-center gap-1 text-[11px]"><HardDrive className="size-3.5"/> محفوظة على هذا الجهاز فقط</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
      <Input value={amount} onChange={(event) => { setAmount(event.target.value); setSaved(false); }} placeholder="المبلغ / الحالة" aria-label="المبلغ أو الحالة المالية المحلية"/>
      <Textarea value={note} onChange={(event) => { setNote(event.target.value); setSaved(false); }} placeholder="ملاحظة مالية خاصة" aria-label="الملاحظة المالية المحلية" className="min-h-11"/>
      <Button type="button" size="sm" variant="secondary" onClick={save}>{saved ? <><Check className="size-4"/> تم</> : "حفظ محلي"}</Button>
    </div>
  </div>;
}
