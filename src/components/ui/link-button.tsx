import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function LinkButton({ className, variant = "primary", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" | "ghost" }) {
  return <Link className={cn("focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition", variant === "primary" && "bg-[#1479b8] text-white hover:bg-[#106da7]", variant === "secondary" && "border border-slate-200 bg-white hover:bg-slate-50", variant === "ghost" && "hover:bg-slate-100", className)} {...props} />;
}
