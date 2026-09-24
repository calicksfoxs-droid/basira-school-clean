import { removeStudentMembershipFormAction } from "@/actions/learning-core";
import { CreateStudentForm } from "@/components/forms/create-user-forms";
import { UserTable } from "@/components/users/user-table";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { getLearningCoreStore } from "@/lib/core";

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const identity = await requireRole("teacher");
  const store = await getStore();
  const core = getLearningCoreStore();
  const [users, subjects] = await Promise.all([
    store.listUsers(identity, "student"),
    core.listLearningSubjects(identity),
  ]);
  const subjectDetails = await Promise.all(subjects.map((subject) => core.getLearningSubject(identity, subject.id)));
  const learningGroups = subjectDetails
    .flatMap((details) => details.groups)
    .filter((group) => group.status === "active");
  const params = await searchParams;

  return <>
    <PageHeader title="طلابي" description="إدارة حسابات الطلاب وعضويتهم في مجموعات Learning Core."/>
    <Notice {...params}/>
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <UserTable users={users} returnTo="/app/teacher/students"/>
      <div className="grid content-start gap-6">
        <Card>
          <CardTitle>طالب جديد</CardTitle>
          <CardDescription>يُنشأ داخل مجموعة Learning Core نشطة تملكها.</CardDescription>
          <div className="mt-5">
            <CreateStudentForm groups={learningGroups} returnTo="/app/teacher/students" teacherId={identity.userId}/>
          </div>
        </Card>
        <Card>
          <CardTitle>إزالة طالب من مجموعة</CardTitle>
          <CardDescription>تزيل الوصول إلى هذه المجموعة فقط ولا تعطل حساب الطالب.</CardDescription>
          {learningGroups.length && users.length ? <form action={removeStudentMembershipFormAction} className="mt-5 grid gap-4">
            <Field label="المجموعة">
              <Select name="groupId" required defaultValue="">
                <option value="" disabled>اختر المجموعة</option>
                {learningGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </Select>
            </Field>
            <Field label="الطالب">
              <Select name="studentId" required defaultValue="">
                <option value="" disabled>اختر الطالب</option>
                {users.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
              </Select>
            </Field>
            <Button variant="danger">إزالة من المجموعة</Button>
          </form> : <p className="mt-4 text-sm text-[var(--muted)]">تحتاج إلى مجموعة Learning Core وطالب واحد على الأقل.</p>}
        </Card>
      </div>
    </div>
  </>;
}
