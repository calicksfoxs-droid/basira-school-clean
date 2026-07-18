import { CreateTeacherForm } from "@/components/forms/create-user-forms";
import { UserTable } from "@/components/users/user-table";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) { const identity=await requireRole("admin"); const users=await (await getStore()).listUsers(identity,"teacher"); const params=await searchParams; return <><PageHeader title="المعلمون" description="إنشاء الحسابات وإدارة الوصول دون تفاصيل موظفين لا نحتاجها."/><Notice {...params}/><div className="grid gap-6 xl:grid-cols-[1fr_360px]"><UserTable users={users} returnTo="/app/admin/teachers"/><Card><CardTitle>معلم جديد</CardTitle><div className="mt-5"><CreateTeacherForm returnTo="/app/admin/teachers"/></div></Card></div></>; }
