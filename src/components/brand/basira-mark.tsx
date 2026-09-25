import { cn } from "@/lib/utils";

export function BasiraMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="بصيرة">
    <svg viewBox="0 0 56 40" aria-hidden="true" className="h-8 w-11 overflow-visible">
      <path d="M3 20C10 6 20 3 31 7c8 3 13 9 16 13-3 4-8 10-16 13C20 37 10 34 3 20Z" fill="#171B2E"/>
      <circle cx="28" cy="20" r="10" fill="#3E51CC"/>
      <circle cx="28" cy="20" r="4" fill="#F6F4EE"/>
      <circle cx="48" cy="7" r="3.4" fill="#D99735"/>
      <circle cx="52" cy="27" r="2.8" fill="#E07A5F"/>
    </svg>
    {!compact && <span className="font-heading text-[1.35rem] font-bold tracking-tight text-[var(--text)]">بصيرة</span>}
  </span>;
}
