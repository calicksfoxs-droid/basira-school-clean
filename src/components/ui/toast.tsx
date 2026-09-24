"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

type Feedback = { message: string; error?: boolean };
export function notify(message: string, error = false) {
  window.dispatchEvent(new CustomEvent<Feedback>("basira:feedback", { detail: { message, error } }));
}

export function ToastRegion() {
  const [toast, setToast] = useState<(Feedback & { id: number }) | null>(null);
  useEffect(() => {
    const receive = (event: Event) => setToast({ ...(event as CustomEvent<Feedback>).detail, id: Date.now() });
    window.addEventListener("basira:feedback", receive);
    return () => window.removeEventListener("basira:feedback", receive);
  }, []);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  return <div className="toast-region" aria-live="polite" aria-atomic="true">
    {toast && <div className="toast soft-enter" data-error={toast.error || undefined} key={toast.id}>
      {toast.error ? <CircleAlert className="size-5 shrink-0"/> : <CheckCircle2 className="size-5 shrink-0"/>}
      <p className="flex-1 text-sm font-bold">{toast.message}</p>
      <button type="button" className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl" onClick={() => setToast(null)} aria-label="إغلاق التنبيه"><X className="size-4"/></button>
    </div>}
  </div>;
}
