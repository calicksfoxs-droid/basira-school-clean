"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="grid min-h-[55vh] place-items-center"><div className="max-w-md rounded-[24px] border border-red-200 bg-[var(--surface)] p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600"><AlertCircle/></span><h1 className="font-heading mt-5 text-2xl font-bold">تعذر تحميل الصفحة</h1><p className="mt-2 text-sm leading-7 text-[var(--muted)]">لم نفقد عملك. حاول مرة أخرى، وإذا استمرت المشكلة ارجع إلى الصفحة الرئيسية.</p><Button className="mt-5" onClick={reset}><RotateCcw className="size-4"/> إعادة المحاولة</Button></div></div>;
}
