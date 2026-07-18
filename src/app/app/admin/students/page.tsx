import { CreateStudentForm } from "@/components/forms/create-user-forms";
import { UserTable } from "@/components/users/user-table";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) { const identity=await requireRole("admin"); const store=await getStore(); const [users,groups]=await Promise.all([store.listUsers(identity,"student"),store.listGroups(identity)]); const params=await searchParams; return <><PageHeader title="الطلاب" description="حسابات الطلاب وربطهم بالمجموعة المناسبة."/><Notice {...params}/><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><UserTable users={users} returnTo="/app/admin/students"/><Card><CardTitle>طالب جديد</CardTitle><div className="mt-5"><CreateStudentForm groups={groups} returnTo="/app/admin/students"/></div></Card></div></>; }
