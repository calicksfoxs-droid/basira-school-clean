"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert, X } from "lucide-react";
import { disableUserAction, resetAccessCodeWithRevealAction } from "@/actions/accounts";
import type { ResetAccessCodeRevealState } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UserRecord } from "@/domain/models";
import { formatDate, roleLabel } from "@/lib/utils";

const initialResetState: ResetAccessCodeRevealState = { ok: true, data: undefined as never };

function ResetAccessCodeButton({ userId, returnTo }: { userId: string; returnTo: string }) {
  const [state, action, pending] = useActionState(resetAccessCodeWithRevealAction, initialResetState);
  const [dismissedCode, setDismissedCode] = useState<string>();
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const revealed = state.ok && state.data ? state.data : undefined;
  const shouldReveal = Boolean(revealed && revealed.code !== dismissedCode);

  useEffect(() => {
    if (!shouldReveal || !dialogRef.current || dialogRef.current.open) return;
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
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button variant="secondary" size="sm" disabled={pending}>{pending ? "جارٍ الإصدار…" : "إعادة الرمز"}</Button>
    </form>
    {!state.ok && <p role="alert" className="mt-2 text-xs font-bold text-red-600">{state.error}</p>}
    {shouldReveal && <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); closeReveal(); }} className="m-auto w-[min(92vw,560px)] rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-[#170b35]/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-8" dir="rtl">
        <div className="flex items-start justify-between gap-4"><div className="grid size-14 place-items-center rounded-2xl bg-[#e7f8f1] text-[#138a66]"><KeyRound className="size-7"/></div><button type="button" onClick={closeReveal} className="focus-ring grid size-11 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--soft)]" aria-label="إغلاق نافذة الرمز"><X className="size-5"/></button></div>
        <h2 className="font-heading mt-5 text-2xl font-bold">رمز دخول جديد لـ {revealed?.displayName}</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">انسخ الرمز الآن. الرمز السابق أصبح غير صالح.</p>
        <div className="mt-6 rounded-2xl bg-[#170b35] p-5 text-center font-mono text-xl font-black tracking-wide text-white" dir="ltr" data-testid="reset-access-code">{revealed?.code}</div>
        <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900"><ShieldAlert className="mt-1 size-4 shrink-0"/><p>لن يظهر هذا الرمز بعد إغلاق النافذة.</p></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><Button type="button" onClick={copyCode}>{copied ? <><Check className="size-4"/> تم النسخ</> : <><Copy className="size-4"/> نسخ الرمز</>}</Button><Button type="button" variant="secondary" onClick={closeReveal}>تم الحفظ والإغلاق</Button></div>
      </div>
    </dialog>}
  </>;
}

export function UserTableClient({ users, returnTo, canManageCredentials }: { users: UserRecord[]; returnTo: string; canManageCredentials: boolean }) {
  return <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] card-shadow">
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-right text-sm"><thead className="bg-[var(--soft)] text-xs text-[var(--muted)]"><tr><th className="p-4">الاسم</th><th className="p-4">الدور</th><th className="p-4">الحالة</th><th className="p-4">تاريخ الإنشاء</th><th className="p-4">إجراءات</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{users.map((user) => {
      const showDisableButton = canManageCredentials && user.status === "active";
      const showResetButton = canManageCredentials;
      return <tr key={user.id}><td className="p-4 font-bold text-[var(--text)]">{user.displayName}</td><td className="p-4 text-[var(--text)]">{roleLabel(user.role)}</td><td className="p-4"><Badge tone={user.status === "active" ? "success" : "danger"}>{user.status === "active" ? "نشط" : "معطل"}</Badge></td><td className="p-4 text-[var(--muted)]">{formatDate(user.createdAt)}</td><td className="p-4"><div className="flex flex-wrap gap-2">{showResetButton && <ResetAccessCodeButton userId={user.id} returnTo={returnTo}/>} {showDisableButton && <form action={disableUserAction}><input type="hidden" name="userId" value={user.id}/><input type="hidden" name="returnTo" value={returnTo}/><Button variant="danger" size="sm">تعطيل</Button></form>}</div></td></tr>;
    })}</tbody></table></div>
  </div>;
}
