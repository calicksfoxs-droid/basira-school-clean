import { CreateStudentForm } from "@/components/forms/create-user-forms";
import { UserTable } from "@/components/users/user-table";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getLearningCoreStore } from "@/lib/core";

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const identity = await requireRole("admin");
  const store = await getStore();
  const core = getLearningCoreStore();
  const [users, subjects] = await Promise.all([
    store.listUsers(identity, "student"),
    core.listLearningSubjects(identity),
  ]);
  const subjectDetails = await Promise.all(subjects.map((subject) => core.getLearningSubject(identity, subject.id)));
  const learningGroups = subjectDetails.flatMap((details) => details.groups).filter((group) => group.status === "active");
  const params = await searchParams;

  return <>
    <PageHeader title="الطلاب" description="إنشاء حسابات الطلاب داخل مجموعات Learning Core النشطة وإدارة الوصول."/>
    <Notice {...params}/>
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <UserTable users={users} returnTo="/app/admin/students"/>
      <Card>
        <CardTitle>طالب جديد</CardTitle>
        <CardDescription>اختر مجموعة Learning Core نشطة فقط.</CardDescription>
        <div className="mt-5"><CreateStudentForm groups={learningGroups} returnTo="/app/admin/students"/></div>
      </Card>
    </div>
  </>;
}
