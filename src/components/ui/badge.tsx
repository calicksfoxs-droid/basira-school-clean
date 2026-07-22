import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" | "info" | "teal" | "coral" | "yellow" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
        tone === "neutral" && "bg-[var(--soft)] text-[var(--muted)]",
        tone === "teal" && "bg-teal-50 text-teal-700",
        tone === "coral" && "bg-rose-50 text-rose-700",
        tone === "yellow" && "bg-amber-50 text-amber-800",
        tone === "success" && "bg-green-50 text-green-700",
        tone === "warning" && "bg-amber-50 text-amber-800",
        tone === "danger" && "bg-red-50 text-red-700",
        tone === "info" && "bg-blue-50 text-blue-700",
        className
      )}
      {...props}
    />
  );
}
