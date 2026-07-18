import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
const base = "focus-ring min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100";
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn(base, className)} {...props} />; }
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={cn(base, "min-h-28 py-3", className)} {...props} />; }
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cn(base, className)} {...props} />; }
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-bold text-slate-700"><span>{label}</span>{children}{hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}</label>; }
