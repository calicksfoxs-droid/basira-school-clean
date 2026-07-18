import { redirect } from "next/navigation";
import { KeyRound, Layers3, ShieldCheck, Video } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { getIdentity } from "@/lib/auth";
import { isDemoBackend } from "@/lib/env";
import { DEMO_CODES } from "@/lib/demo/demo-db";
import { roleHome } from "@/lib/utils";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const identity = await getIdentity();
  if (identity) redirect(roleHome(identity.role));
  const { error } = await searchParams;
  return <main className="min-h-screen bg-[#f7fafc] p-4 sm:grid sm:place-items-center">
    <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white card-shadow lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden min-h-[680px] overflow-hidden bg-[#0b1d33] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-20 top-20 size-72 rounded-full bg-cyan-300/10 blur-3xl"/><div className="absolute -bottom-20 right-10 size-72 rounded-full bg-emerald-300/10 blur-3xl"/>
        <div className="relative"><p className="text-sm font-bold text-cyan-200">بصيرة</p><h1 className="mt-4 max-w-xl text-4xl font-black leading-[1.45]">كل شخص يرى ما يحتاجه فقط.</h1><p className="mt-5 max-w-xl leading-8 text-white/65">دروس، ملازم، اختبارات، وتصحيح في مكان واحد بسيط بدل الروابط والمجموعات المتفرقة.</p></div>
        <div className="relative grid gap-3 sm:grid-cols-2">{[
          [Layers3,"مساحة واضحة لكل دور"],[Video,"رفع فيديو وملزمة"],[ShieldCheck,"صلاحيات مغلقة وآمنة"],[KeyRound,"دخول برمز واحد"]
        ].map(([Icon,label]) => { const C=Icon as typeof KeyRound; return <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 p-4"><C className="size-5 text-cyan-200"/><span className="text-sm font-bold">{String(label)}</span></div>; })}</div>
      </section>
      <section className="flex min-h-[620px] items-center p-6 sm:p-12"><div className="mx-auto w-full max-w-md"><div className="mb-8"><span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-[#1479b8]">منصة خاصة</span><h2 className="mt-4 text-3xl font-black">مرحبًا بك</h2><p className="mt-2 text-sm leading-7 text-slate-500">أدخل رمز الدخول الذي حصلت عليه من الإدارة أو المعلم.</p></div><Notice error={error}/><form action={loginAction} className="grid gap-5"><Field label="رمز الدخول"><Input name="code" required autoComplete="one-time-code" dir="ltr" className="text-center font-mono text-lg tracking-wide" placeholder="BSR-XXXX-XXXXXXXX"/></Field><Button size="lg">دخول</Button></form>
      {isDemoBackend && <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-black text-amber-900">وضع العرض المحلي</p><div className="mt-3 grid gap-2 font-mono text-xs text-amber-800" dir="ltr"><code>{DEMO_CODES.admin}</code><code>{DEMO_CODES.teacher}</code><code>{DEMO_CODES.student}</code></div></div>}</div></section>
    </div>
  </main>;
}
