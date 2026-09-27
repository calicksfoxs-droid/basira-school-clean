import { enrollExistingStudentFormAction, removeStudentMembershipFormAction } from "@/actions/learning-core";
import { UserTable } from "@/components/users/user-table";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
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
    <PageHeader title="طلابي" description="أضف حسابًا موجودًا إلى مجموعتك باستخدام معرّف الانضمام الخاص بالطالب."/>
    <Notice {...params}/>
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <UserTable users={users} returnTo="/app/teacher/students"/>
      <div className="grid content-start gap-6">
        <Card>
          <CardTitle>إضافة طالب إلى مجموعة</CardTitle>
          <CardDescription>لا ينشئ المعلّم حسابات جديدة. اطلب من الطالب معرّف الانضمام الخاص به وأضفه إلى مجموعة المادة.</CardDescription>
          {learningGroups.length ? <form action={enrollExistingStudentFormAction} className="mt-5 grid gap-4">
            <Field label="المجموعة">
              <Select name="groupId" required defaultValue="">
                <option value="" disabled>اختر المجموعة</option>
                {learningGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </Select>
            </Field>
            <Field label="معرّف انضمام الطالب">
              <Input name="enrollmentReference" required autoComplete="off" placeholder="BSR-S-XXXXXXXXXXXX" dir="ltr"/>
            </Field>
            <Button>إضافة الطالب</Button>
          </form> : <p className="mt-4 text-sm text-[var(--muted)]">أنشئ مجموعة Learning Core نشطة أولًا.</p>}
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
          </form> : <p className="mt-4 text-sm text-[var(--muted)]">تحتاج إلى مجموعة Learning Core وطالب مسجل واحد على الأقل.</p>}
        </Card>
      </div>
    </div>
  </>;
}
