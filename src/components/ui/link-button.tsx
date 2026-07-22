import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function LinkButton({ className, variant = "primary", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" | "ghost" }) {
  return <Link className={cn("focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition", variant === "primary" && "bg-[var(--brand)] text-white hover:brightness-95", variant === "secondary" && "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--soft)]", variant === "ghost" && "text-[var(--text)] hover:bg-[var(--soft)]", className)} {...props} />;
}
