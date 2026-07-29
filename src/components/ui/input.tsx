import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
const base = "focus-ring min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] disabled:bg-[var(--soft)]";
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn(base, className)} {...props} />; }
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={cn(base, "min-h-28 py-3", className)} {...props} />; }
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cn(base, className)} {...props} />; }
export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-[var(--text)]"><span className="flex items-center gap-2">{label}{required && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-900">مطلوب</span>}</span>{children}{hint && <span className="text-xs font-normal text-[var(--muted)]">{hint}</span>}</label>;
}
