import { CreateGroupForm } from "@/components/forms/create-group-form";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
export default async function Page() { const identity=await requireRole("admin"); const teachers=identity.role === "admin" ? await (await getStore()).listUsers(identity,"teacher") : undefined; return <div className="mx-auto max-w-2xl"><PageHeader title="إنشاء مجموعة" description="اسم واضح، معلم واحد مسؤول، ثم نضيف الطلاب والمواد."/><Card><CardTitle>بيانات المجموعة</CardTitle><div className="mt-5"><CreateGroupForm identity={identity} teachers={teachers} returnTo="/app/admin/groups/new"/></div></Card></div>; }
