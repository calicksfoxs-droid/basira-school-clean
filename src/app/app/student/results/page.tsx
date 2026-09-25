import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export default async function Page() {
  const identity = await requireRole("student");
  const submissions = await (await getStore()).listSubmissions(identity);
  const released = submissions.filter(item => item.status === "released").length;
  return <><PageHeader title="نتائجي" description="راجع محاولاتك وإجاباتك، وتعرّف على ما أنجزته."/>
    {submissions.length ? <div className="grid gap-6">
      <section className="flex flex-wrap items-center gap-5 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6"><span className="grid size-16 place-items-center rounded-2xl bg-[var(--soft)] text-[var(--accent)]"><ClipboardCheck className="size-8"/></span><div><h2 className="font-heading text-xl font-bold">سجلّ تعلّمك</h2><p className="mt-2 text-sm text-[var(--muted)]">{submissions.length} محاولات مسجّلة · {released} نتائج متاحة للمراجعة</p></div></section>
      <div className="grid gap-4 md:grid-cols-2">{submissions.map((item, index) => <Link className="focus-ring group rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-1 hover:shadow-lg" key={item.id} href={`/app/student/results/${item.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-bold text-[var(--muted)]">المحاولة {index + 1}</span><Badge tone={item.status === "released" ? "success" : "warning"}>{item.status === "released" ? "النتيجة متاحة" : "بانتظار النتيجة"}</Badge></div>
        <div className="my-6 flex items-end gap-2"><strong className="font-heading text-4xl text-[var(--brand)]">{item.status === "released" ? item.totalScore : "—"}</strong><span className="pb-1 text-sm text-[var(--muted)]">نقطة</span></div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><time dateTime={item.submittedAt} className="text-xs text-[var(--muted)]">{formatDate(item.submittedAt)}</time><span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand)]">تفاصيل المحاولة<ArrowLeft className="size-4"/></span></div>
      </Link>)}</div>
    </div> : <EmptyState title="لا توجد نتائج بعد" description="أكمل اختبارًا من دروسك لتجد نتيجته هنا." action={<Link className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-5 font-bold text-[var(--on-primary)]" href="/app/student/grades">العودة إلى صفوفي</Link>}/>}</>;
}
