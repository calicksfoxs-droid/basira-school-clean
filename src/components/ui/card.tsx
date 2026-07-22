import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 card-shadow", className)} {...props} />; }
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h2 className={cn("font-heading text-lg font-bold text-[var(--text)]", className)} {...props} />; }
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) { return <p className={cn("mt-1 text-sm leading-7 text-[var(--muted)]", className)} {...props} />; }
