import { AnnouncementForm } from "@/components/forms/announcement-form";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { AnnouncementFeed } from "@/components/announcements/feed";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) { const identity=await requireRole("teacher"); const store=await getStore(); const [groups,items]=await Promise.all([store.listGroups(identity),store.listAnnouncements(identity)]); const params=await searchParams; return <><PageHeader title="الإعلانات" description="آخر الرسائل والتحديثات التي تشاركها مع مجتمعك التعليمي."/><Notice {...params}/><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><AnnouncementFeed items={items}/><Card><CardTitle>إعلان جديد</CardTitle><div className="mt-5"><AnnouncementForm identity={identity} groups={groups} returnTo="/app/teacher/announcements"/></div></Card></div></>; }
