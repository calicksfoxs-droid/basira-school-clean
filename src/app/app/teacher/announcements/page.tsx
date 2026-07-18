import { AnnouncementForm } from "@/components/forms/announcement-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) { const identity=await requireRole("teacher"); const store=await getStore(); const [groups,items]=await Promise.all([store.listGroups(identity),store.listAnnouncements(identity)]); const params=await searchParams; return <><PageHeader title="الإعلانات" description="رسالة قصيرة وإجراء واحد؛ بدون زحمة أو نظام إشعارات ضخم."/><Notice {...params}/><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><div className="grid gap-3">{items.map(item=><Card key={item.id}><div className="flex items-start justify-between gap-4"><div><CardTitle>{item.title}</CardTitle><CardDescription>{item.body}</CardDescription></div><Badge tone={item.targetType === "global" ? "info" : "neutral"}>{item.targetType === "global" ? "عام" : "مجموعة"}</Badge></div></Card>)}</div><Card><CardTitle>إعلان جديد</CardTitle><div className="mt-5"><AnnouncementForm identity={identity} groups={groups} returnTo="/app/teacher/announcements"/></div></Card></div></>; }
