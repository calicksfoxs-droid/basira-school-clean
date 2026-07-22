import Image from "next/image";
import { redirect } from "next/navigation";
import { BookOpen, Compass, ShieldCheck } from "lucide-react";
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
  return <main className="grid min-h-screen bg-[#f7f4ec] lg:grid-cols-[1.05fr_.95fr]" dir="rtl">
    <section className="relative hidden min-h-screen overflow-hidden bg-[#170b35] lg:block">
      <Image src="/images/basira/arabic-hero-spectrum-v1.png" alt="كتاب مفتوح يقود إلى مرصد المعرفة" fill priority sizes="55vw" className="object-cover"/>
      <div className="absolute inset-0 bg-[#170b35]/35"/>
      <div className="relative flex h-full flex-col justify-between p-12 text-white xl:p-16"><div><div className="font-heading text-3xl font-bold">بصيرة</div><p className="mt-2 text-sm text-white/65">منصة تعليمية عربية خفيفة</p></div><div className="max-w-xl"><span className="text-sm font-bold text-[#57e3d2]">تعليم يُرى… ومسار يُفهم</span><h1 className="font-heading mt-4 text-4xl font-bold leading-[1.5] xl:text-5xl">مساحة تجمع المعلم وطلابه دون تعقيد.</h1><div className="mt-8 grid gap-3 sm:grid-cols-3">{[[BookOpen,"مواد منظمة"],[Compass,"رحلة واضحة"],[ShieldCheck,"صلاحيات آمنة"]].map(([Icon,label]) => { const C = Icon as typeof BookOpen; return <div key={String(label)} className="flex items-center gap-2 rounded-2xl border border-white/15 bg-[#170b35]/70 p-4"><C className="size-5 text-[#ffd64a]"/><span className="text-sm font-bold">{String(label)}</span></div>; })}</div></div></div>
    </section>
    <section className="flex min-h-screen items-center p-5 sm:p-10"><div className="mx-auto w-full max-w-md"><div className="mb-8 lg:hidden"><div className="font-heading text-3xl font-bold text-[#2b1459]">بصيرة</div><p className="mt-1 text-sm text-[#596579]">تعليم يُرى، ومسار يُفهم.</p></div><span className="inline-flex rounded-full bg-[#eef2f6] px-3 py-1 text-xs font-black text-[#173b63]">منصة خاصة</span><h2 className="font-heading mt-4 text-3xl font-bold text-[#172033]">مرحبًا بعودتك</h2><p className="mt-3 text-sm leading-7 text-[#596579]">أدخل رمز الدخول الذي حصلت عليه من الإدارة أو المعلم.</p><div className="mt-7"><Notice error={error}/></div><form action={loginAction} className="grid gap-5"><Field label="رمز الدخول"><Input name="code" required autoComplete="one-time-code" dir="ltr" className="text-center font-mono text-lg tracking-wide" placeholder="BSR-XXXX-XXXXXXXX"/></Field><Button size="lg" className="w-full">دخول</Button></form>
      {isDemoBackend && <details className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"><summary className="cursor-pointer font-black text-amber-900">رموز العرض المحلي</summary><div className="mt-3 grid gap-2 font-mono text-xs text-amber-800" dir="ltr"><code>{DEMO_CODES.admin}</code><code>{DEMO_CODES.teacher}</code><code>{DEMO_CODES.student}</code></div></details>}
      <p className="mt-8 text-center text-xs leading-6 text-[#7a7187]">رمزك خاص بحسابك. لا ترسله لأي شخص.</p></div></section>
  </main>;
}
