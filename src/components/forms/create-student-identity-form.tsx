"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert, X } from "lucide-react";
import {
  createStudentIdentityWithRevealAction,
  type CreateStudentIdentityState,
} from "@/actions/student-identity";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function CreateStudentIdentityForm() {
  const initialState: CreateStudentIdentityState = { ok: true, data: undefined as never };
  const [state, action, pending] = useActionState(createStudentIdentityWithRevealAction, initialState);
  const [dismissedCode, setDismissedCode] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [creationRequestId, setCreationRequestId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const revealed = state.ok && state.data ? state.data : undefined;
  const shouldReveal = Boolean(revealed && revealed.code !== dismissedCode);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setCreationRequestId((current) => current || globalThis.crypto.randomUUID());
    }, 0);
    return () => globalThis.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!shouldReveal || !dialogRef.current || dialogRef.current.open) return;
    formRef.current?.reset();
    setCreationRequestId(globalThis.crypto.randomUUID());
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
      <input type="hidden" name="creationRequestId" value={creationRequestId}/>
      <Field label="اسم الطالب"><Input name="displayName" required placeholder="مثال: محمد أحمد"/></Field>
      <p className="text-xs leading-6 text-[var(--muted)]">
        هذا ينشئ هوية دخول فقط. لا يُضاف الطالب إلى أي مادة أو مجموعة تلقائيًا.
      </p>
      {!state.ok && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{state.error}</p>}
      <Button disabled={pending || !creationRequestId}>{pending ? "جارٍ إنشاء الحساب…" : "إنشاء حساب الطالب"}</Button>
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
        <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900"><ShieldAlert className="mt-1 size-4 shrink-0"/><p>بعد تسجيل الدخول، يستخدم الطالب معرّف الانضمام الخاص به للالتحاق بمجموعات المواد عبر المعلّم.</p></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" onClick={copyCode}>{copied ? <><Check className="size-4"/> تم النسخ</> : <><Copy className="size-4"/> نسخ الرمز</>}</Button>
          <Button type="button" variant="secondary" onClick={closeReveal}>تم الحفظ والإغلاق</Button>
        </div>
      </div>
    </dialog>}
  </>;
}
