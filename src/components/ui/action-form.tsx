"use client";

import { useRouter } from "next/navigation";
import { useActionState, type ReactNode } from "react";
import { notify } from "./toast";
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
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult<unknown>, formData: FormData) => {
      const result = await action(formData);
      notify(result.ok ? result.message || "تم الحفظ بنجاح" : result.error, !result.ok);
      if (result.ok) router.refresh();
      return result;
    },
    { ok: true, data: undefined } as ActionResult<unknown>,
  );

  return (
    <form aria-busy={pending} action={formAction} className={className}>
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
