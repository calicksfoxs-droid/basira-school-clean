import Link from "next/link";
import { Megaphone } from "lucide-react";
import type { Announcement } from "@/domain/models";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export function AnnouncementFeed({ items }: { items: Announcement[] }) {
  if (!items.length) return <EmptyState title="لا توجد إعلانات بعد" description="ستظهر الرسائل هنا. يمكنك إضافة إعلان باستخدام النموذج."/>;
  return <div className="grid content-start gap-4">{items.map(item => <article key={item.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
    <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--soft)] text-[var(--accent)]"><Megaphone className="size-5"/></span><div className="min-w-0 flex-1"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-[var(--muted)]">{item.creatorRole === "admin" ? "إدارة المنصة" : "المعلم"} · <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></span><Badge tone={item.targetType === "global" ? "info" : "neutral"}>{item.targetType === "global" ? "عام" : "مجموعة"}</Badge></div><h2 className="font-heading text-lg font-bold">{item.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-[var(--muted)]">{item.body}</p>{item.ctaPath && item.ctaLabel && <Link className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--soft)] px-4 text-sm font-bold text-[var(--brand)]" href={item.ctaPath}>{item.ctaLabel}</Link>}</div></div>
  </article>)}</div>;
}
