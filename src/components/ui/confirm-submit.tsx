"use client";

import { useId, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "./button";

/** Uses the surrounding form and its existing action; no mutation until confirmed. */
export function ConfirmSubmit({ name, label = "حذف", description = "سيُزال هذا العنصر من المحتوى. تأكد قبل المتابعة." }: { name: string; label?: string; description?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  return <>
    <button ref={trigger} type="button" onClick={() => dialog.current?.showModal()} className="focus-ring grid min-h-11 min-w-11 place-items-center rounded-xl text-[var(--danger)] hover:bg-[var(--soft)]" aria-label={`${label} ${name}`}><Trash2 className="size-4"/></button>
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} className="confirmation-dialog">
      <h2 id={titleId} className="font-heading text-xl font-bold">{label} «{name}»؟</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" autoFocus onClick={() => dialog.current?.close()}>إلغاء</Button>
        <Button type="button" variant="danger" onClick={() => { dialog.current?.close(); trigger.current?.form?.requestSubmit(); }}>تأكيد {label}</Button>
      </div>
    </dialog>
  </>;
}
