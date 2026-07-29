"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert, X } from "lucide-react";
import {
  createStudentWithRevealAction,
  createTeacherWithRevealAction,
} from "@/actions/accounts";
import type { CreateStudentRevealState, CreateTeacherRevealState } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Group } from "@/domain/models";

export function CreateTeacherForm({ returnTo }: { returnTo: string }) {
  const initialState: CreateTeacherRevealState = { ok: true, data: undefined as never };
  const [state, action, pending] = useActionState(createTeacherWithRevealAction, initialState);
  const [dismissedCode, setDismissedCode] = useState<string>();
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const revealed = state.ok && state.data ? state.data : undefined;
  const shouldReveal = Boolean(revealed && revealed.code !== dismissedCode);

  useEffect(() => {
    if (!shouldReveal || !dialogRef.current || dialogRef.current.open) return;
    formRef.current?.reset();
    dialogRef.current.showModal();
  }, [shouldReveal]);

  function closeReveal() {
    if (revealed) setDismissedCode(revealed.code);
    setCopied(false);
    dialogRef.current?.close();
  }

  async function copyCode() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.code);
    setCopied(true);
  }

  return <>
    <form ref={formRef} action={action} className="grid gap-5">
      <input type="hidden" name="returnTo" value={returnTo}/>
      <Field label="اسم المعلّم"><Input name="displayName" required placeholder="مثال: أ. أحمد علي"/></Field>
      {!state.ok && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{state.error}</p>}
      <Button disabled={pending}>{pending ? "جارٍ إنشاء المعلّم…" : "إنشاء الحساب وإصدار الرمز"}</Button>
    </form>

    {shouldReveal && <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); closeReveal(); }} className="m-auto w-[min(92vw,560px)] rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-[#170b35]/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-8" dir="rtl">
        <div className="flex items-start justify-between gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-[#e7f8f1] text-[#138a66]"><KeyRound className="size-7"/></div>
          <button type="button" onClick={closeReveal} className="focus-ring grid size-11 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--soft)]" aria-label="إغلاق نافذة الرمز"><X className="size-5"/></button>
        </div>
        <h2 className="font-heading mt-5 text-2xl font-bold">رمز دخول {revealed?.displayName}</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">انسخ الرمز الآن وسلّمه للمعلّم بطريقة آمنة. لن يظهر مرة أخرى بعد إغلاق هذه النافذة.</p>
        <div className="mt-6 rounded-2xl bg-[#170b35] p-5 text-center font-mono text-xl font-black tracking-wide text-white" dir="ltr" data-testid="teacher-access-code">{revealed?.code}</div>
        <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900"><ShieldAlert className="mt-1 size-4 shrink-0"/><p>احفظ الرمز في مكان آمن. إعادة تعيينه لاحقًا تُبطل الرمز القديم.</p></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" onClick={copyCode}>{copied ? <><Check className="size-4"/> تم النسخ</> : <><Copy className="size-4"/> نسخ الرمز</>}</Button>
          <Button type="button" variant="secondary" onClick={closeReveal}>تم الحفظ والإغلاق</Button>
        </div>
      </div>
    </dialog>}
  </>;
}

export function CreateStudentForm({ groups, returnTo, fixedGroupId }: { groups: Group[]; returnTo: string; fixedGroupId?: string }) {
  const initialCreateStudentRevealState: CreateStudentRevealState = { ok: true, data: undefined as never };
  const [state, action, pending] = useActionState(createStudentWithRevealAction, initialCreateStudentRevealState);
  const [dismissedCode, setDismissedCode] = useState<string>();
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const revealed = state.ok && state.data ? state.data : undefined;
  const shouldReveal = Boolean(revealed && revealed.code !== dismissedCode);

  useEffect(() => {
    if (!shouldReveal || !dialogRef.current || dialogRef.current.open) return;
    formRef.current?.reset();
    dialogRef.current.showModal();
  }, [shouldReveal]);

  function closeReveal() {
    if (revealed) setDismissedCode(revealed.code);
    setCopied(false);
    dialogRef.current?.close();
  }

  async function copyCode() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.code);
    setCopied(true);
  }

  return <>
    <form ref={formRef} action={action} className="grid gap-5">
      <input type="hidden" name="returnTo" value={returnTo}/>
      <Field label="اسم الطالب"><Input name="displayName" required/></Field>
      {fixedGroupId ? <input type="hidden" name="groupId" value={fixedGroupId}/> : <Field label="المجموعة"><Select name="groupId" required defaultValue=""><option value="" disabled>اختر المجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="رقم التواصل" hint="خاص بالمعلم والإدارة"><Input name="contactNumber" dir="ltr"/></Field><Field label="المبلغ / الحالة" hint="ملاحظة داخلية فقط"><Input name="amountNote"/></Field></div>
      <Field label="ملاحظة خاصة"><Textarea name="paymentNote"/></Field>
      {!state.ok && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{state.error}</p>}
      <Button disabled={pending}>{pending ? "جارٍ إنشاء الطالب…" : "إنشاء الطالب وإصدار الرمز"}</Button>
    </form>

    {shouldReveal && <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); closeReveal(); }} className="m-auto w-[min(92vw,560px)] rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-[#170b35]/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-8" dir="rtl">
        <div className="flex items-start justify-between gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-[#e7f8f1] text-[#138a66]"><KeyRound className="size-7"/></div>
          <button type="button" onClick={closeReveal} className="focus-ring grid size-11 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--soft)]" aria-label="إغلاق نافذة الرمز"><X className="size-5"/></button>
        </div>
        <h2 className="font-heading mt-5 text-2xl font-bold">رمز دخول {revealed?.displayName}</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">انسخ الرمز الآن وسلمه للطالب بطريقة آمنة. لن يظهر مرة أخرى بعد إغلاق هذه النافذة.</p>
        <div className="mt-6 rounded-2xl bg-[#170b35] p-5 text-center font-mono text-xl font-black tracking-wide text-white" dir="ltr" data-testid="student-access-code">{revealed?.code}</div>
        <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900"><ShieldAlert className="mt-1 size-4 shrink-0"/><p>احفظ الرمز في مكان آمن. إعادة تعيينه لاحقًا تُبطل الرمز القديم.</p></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" onClick={copyCode}>{copied ? <><Check className="size-4"/> تم النسخ</> : <><Copy className="size-4"/> نسخ الرمز</>}</Button>
          <Button type="button" variant="secondary" onClick={closeReveal}>تم الحفظ والإغلاق</Button>
        </div>
      </div>
    </dialog>}
  </>;
}
