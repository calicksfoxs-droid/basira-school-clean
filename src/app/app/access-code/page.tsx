import { redirect } from "next/navigation";
import { Copy, KeyRound, ShieldAlert } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { requireRole } from "@/lib/auth";
import { readAccessCodeFlash } from "@/lib/flash";

export const metadata = { title: "رمز الدخول الجديد" };
export default async function AccessCodePage() {
  const identity = await requireRole("admin", "teacher");
  const flash = await readAccessCodeFlash();
  if (!flash) redirect(`/app/${identity.role}`);
  return <div className="mx-auto max-w-xl py-12"><Card className="border-sky-200 p-7"><div className="grid size-14 place-items-center rounded-2xl bg-sky-50 text-[#1479b8]"><KeyRound className="size-7"/></div><CardTitle className="mt-5">رمز دخول {flash.displayName}</CardTitle><CardDescription>انسخ الرمز الآن وشاركه مع صاحبه بطريقة آمنة. لن نعرض السر كاملًا من قائمة الحسابات لاحقًا.</CardDescription><div className="mt-6 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-center font-mono text-xl font-black tracking-wide text-white" dir="ltr">{flash.code}</div><div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900"><ShieldAlert className="mt-1 size-4 shrink-0"/><p>لا تحفظ الرمز في صورة عامة أو تقرير. إعادة تعيين الرمز تلغي القديم.</p></div><div className="mt-6 flex flex-wrap gap-3"><LinkButton href={`/app/${identity.role}`}>العودة للرئيسية</LinkButton><span className="inline-flex items-center gap-2 text-xs text-slate-500"><Copy className="size-4"/> حدده وانسخه يدويًا</span></div></Card></div>;
}
