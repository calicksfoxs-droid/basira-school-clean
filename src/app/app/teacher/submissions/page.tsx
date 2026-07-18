import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { formatDate } from "@/lib/utils";
export default async function Page() { const identity=await requireRole("teacher"); const submissions=await (await getStore()).listSubmissions(identity); return <><PageHeader title="التصحيح" description="التسليمات المقالية فقط هي التي تحتاج تدخلك."/>{submissions.length ? <div className="grid gap-3">{submissions.map(item=><Link key={item.id} href={`/app/teacher/submissions/${item.id}`}><Card className="flex items-center justify-between gap-4 hover:border-sky-200"><div className="flex items-center gap-3"><ClipboardCheck className="size-5 text-amber-600"/><div><p className="font-black">تسليم {item.id.slice(0,8)}</p><p className="text-xs text-slate-500">{formatDate(item.submittedAt)}</p></div></div><Badge tone={item.status === "released" ? "success" : item.status === "pending_review" ? "warning" : "info"}>{item.status === "pending_review" ? "قيد التصحيح" : item.status === "released" ? "صادر" : "تم التصحيح"}</Badge></Card></Link>)}</div> : <EmptyState title="لا توجد تسليمات"/>}</>; }
