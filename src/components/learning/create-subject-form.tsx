"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createLearningSubjectWithStateAction } from "@/actions/learning-core";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

type CreateSubjectState = ActionResult<{ id: string }>;
const initialState: CreateSubjectState = { ok: true, data: undefined as never };

export function CreateSubjectForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createLearningSubjectWithStateAction, initialState);

  useEffect(() => {
    if (state.ok && state.data?.id) router.push(`/app/teacher/subjects/${state.data.id}`);
  }, [router, state]);

  return <form action={action} noValidate className="mt-5 grid gap-4">
    <Field label="اسم المادة" required hint="اكتب اسمًا من حرفين أو أكثر — مثال: الرياضيات">
      <Input name="title" required placeholder="اكتب اسم المادة هنا" autoComplete="off" />
    </Field>
    <Field label="وصف مختصر" hint="اختياري — سيظهر للطلاب قبل بدء المادة">
      <Textarea name="description" placeholder="ماذا سيتعلم الطالب؟" />
    </Field>
    {!state.ok && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">{state.error}</p>}
    <Button disabled={pending}>{pending ? "جارٍ إنشاء المادة…" : "إنشاء المادة وفتحها"}</Button>
  </form>;
}
