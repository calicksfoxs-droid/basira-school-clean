import Link from "next/link";
import { ArrowLeft, School, Users } from "lucide-react";
import type { Group, Identity } from "@/domain/models";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export function GroupGrid({ groups, identity }: { groups: Group[]; identity: Identity }) {
  if (!groups.length) return <EmptyState title="لا توجد مجموعات" description={identity.role === "teacher" ? "أنشئ مجموعتك الأولى ثم أضف الطلاب والمواد." : "ستظهر المجموعات المعينة هنا."}/>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groups.map((group) => <Link key={group.id} href={`/app/${identity.role}/groups/${group.id}`} className="focus-ring group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-sky-200 card-shadow"><div className="flex items-start justify-between"><div className="grid size-11 place-items-center rounded-xl bg-sky-50 text-[#1479b8]"><School className="size-5"/></div><Badge tone={group.status === "active" ? "success" : "neutral"}>{group.status === "active" ? "نشطة" : "معطلة"}</Badge></div><h2 className="mt-5 text-lg font-black">{group.name}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{group.description || "مجموعة تعليمية خاصة"}</p><div className="mt-5 flex items-center justify-between text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1"><Users className="size-4"/> فتح المجموعة</span><ArrowLeft className="size-4 transition group-hover:-translate-x-1"/></div></Link>)}</div>;
}
