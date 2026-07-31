"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCurriculumGradeWithStateAction } from "@/actions/learning-core";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

type State = ActionResult<{ id: string }>;
const initialState: State = { ok: true, data: undefined as never };

export function CreateGradeForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createCurriculumGradeWithStateAction, initialState);
  useEffect(() => {
    if (state.ok && state.data?.id) router.push(`/app/teacher/grades/${state.data.id}`);
  }, [router, state]);
  return <form action={action} noValidate className="mt-5 grid gap-4">
    <Field label="اسم الصف" required hint="مثال: الصف الأول الثانوي"><Input name="title" required placeholder="اكتب اسم الصف"/></Field>
    <Field label="وصف مختصر" hint="اختياري"><Textarea name="description" placeholder="الفصل أو المسار أو أي وصف مساعد"/></Field>
    {!state.ok && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">{state.error}</p>}
    <Button disabled={pending}>{pending ? "جارٍ إنشاء الصف…" : "إضافة الصف"}</Button>
  </form>;
}
