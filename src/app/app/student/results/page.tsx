import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page() { const identity=await requireRole("student"); const submissions=await (await getStore()).listSubmissions(identity); return <><PageHeader title="نتائجي" description="نتائجك أنت فقط؛ لا ترتيب ولا مقارنات."/>{submissions.length ? <div className="grid gap-3">{submissions.map(item=><Link key={item.id} href={`/app/student/results/${item.id}`}><Card className="flex items-center justify-between"><div><p className="font-black">اختبار {item.quizId.slice(0,8)}</p><p className="text-xs text-slate-500">الدرجة: {item.status === "released" ? item.totalScore : "—"}</p></div><Badge tone={item.status === "released" ? "success" : "warning"}>{item.status === "released" ? "النتيجة متاحة" : "قيد التصحيح"}</Badge></Card></Link>)}</div> : <EmptyState title="لا توجد نتائج بعد"/>}</>; }
