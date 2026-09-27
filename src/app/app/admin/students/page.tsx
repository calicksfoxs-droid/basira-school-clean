import { CreateStudentIdentityForm } from "@/components/forms/create-student-identity-form";
import { UserTable } from "@/components/users/user-table";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const identity = await requireRole("admin");
  const users = await (await getStore()).listUsers(identity, "student");
  const params = await searchParams;

  return <>
    <PageHeader title="الطلاب" description="إدارة هويات دخول الطلاب. التسجيل في المواد والمجموعات عملية منفصلة لدى المعلّم."/>
    <Notice {...params}/>
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <UserTable users={users} returnTo="/app/admin/students"/>
      <Card>
        <CardTitle>حساب طالب جديد</CardTitle>
        <CardDescription>أنشئ هوية دخول فقط؛ لن يُضاف الطالب تلقائيًا إلى أي مادة أو مجموعة.</CardDescription>
        <div className="mt-5"><CreateStudentIdentityForm/></div>
      </Card>
    </div>
  </>;
}
