"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";

type ServerFormAction = (formData: FormData) => Promise<ActionResult<unknown>>;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: ServerFormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult<unknown>, formData: FormData) => action(formData),
    { ok: true, data: undefined } as ActionResult<unknown>,
  );

  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-xs font-bold ${state.ok ? "text-[var(--accent)]" : "text-red-600"}`}
      >
        {pending ? "جارٍ الحفظ…" : state.ok ? state.message : state.error}
      </p>
    </form>
  );
}
