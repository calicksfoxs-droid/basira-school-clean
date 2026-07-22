"use client";

import { useState } from "react";
import { Check, Copy, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReferenceMetadata = { maskedReference: string; rotatedAt: string };
type RevealedReference = ReferenceMetadata & { reference: string };

export function EnrollmentReferenceCard({ initial }: { initial: ReferenceMetadata }) {
  const [metadata, setMetadata] = useState(initial);
  const [revealed, setRevealed] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function rotate() {
    setBusy(true); setCopied(false);
    try {
      const response = await fetch("/api/learning/enrollment-reference", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("تعذر تدوير المعرّف");
      const data = await response.json() as RevealedReference;
      setMetadata(data); setRevealed(data.reference);
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
  }

  return <section className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5">
    <h2 className="font-heading text-lg font-bold">معرّف الانضمام</h2>
    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">أرسله للمعلم ليسجلك في مجموعته. هذا ليس رمز دخول حسابك.</p>
    <div className="mt-4 rounded-2xl bg-[var(--soft)] p-4 text-center font-mono text-lg font-bold" dir="ltr">{revealed || metadata.maskedReference}</div>
    {revealed ? <div className="mt-4 grid gap-3"><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-900">احفظه الآن؛ لن يظهر كاملًا مرة أخرى بعد إغلاق هذه الرسالة.</p><div className="flex gap-2"><Button type="button" onClick={copy} className="flex-1">{copied ? <Check className="size-4"/> : <Copy className="size-4"/>}{copied ? "تم النسخ" : "نسخ"}</Button><Button type="button" variant="secondary" onClick={() => setRevealed(undefined)}><EyeOff className="size-4"/> إغلاق</Button></div></div> : <Button type="button" variant="secondary" className="mt-4 w-full" onClick={rotate} disabled={busy}><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`}/>{busy ? "جارٍ التدوير" : "تدوير المعرّف"}</Button>}
  </section>;
}
