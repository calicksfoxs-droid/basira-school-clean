import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = cva("focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50", {
  variants: {
    variant: {
      primary: "bg-[var(--brand)] text-white hover:brightness-95 active:translate-y-px",
      teal: "bg-[var(--teal)] text-white hover:brightness-95 active:translate-y-px",
      coral: "bg-[var(--coral)] text-white hover:brightness-95 active:translate-y-px",
      yellow: "bg-[var(--yellow)] text-[var(--violet)] hover:brightness-95 active:translate-y-px",
      secondary: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--soft)]",
      ghost: "text-[var(--text)] hover:bg-[var(--soft)]",
      danger: "bg-[var(--danger)] text-white hover:brightness-95",
    },
    size: { sm: "min-h-11 px-3 text-xs", md: "", lg: "min-h-12 px-6 text-base" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export function Button({ className, variant, size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return <button className={cn(variants({ variant, size }), className)} {...props} />;
}
