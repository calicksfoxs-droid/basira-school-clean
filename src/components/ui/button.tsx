import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = cva("focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50", {
  variants: {
    variant: {
      primary: "bg-[#1479b8] text-white hover:bg-[#106da7] active:translate-y-px",
      secondary: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
      ghost: "text-slate-700 hover:bg-slate-100",
      danger: "bg-red-600 text-white hover:bg-red-700",
    },
    size: { sm: "min-h-9 px-3 text-xs", md: "", lg: "min-h-12 px-6 text-base" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export function Button({ className, variant, size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return <button className={cn(variants({ variant, size }), className)} {...props} />;
}
