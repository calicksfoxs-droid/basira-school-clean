import { removeLearningStudentFormAction } from "@/actions/learning-core";
import { CreateStudentForm } from "@/components/forms/create-user-forms";
import { UserTable } from "@/components/users/user-table";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";
import { getStore } from "@/lib/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const identity = await requireRole("teacher");
  const store = await getStore();
  const core = getLearningCoreStore();

  const subjects = await core.listLearningSubjects(identity);
  const subjectDetails = await Promise.all(subjects.map((subject) => core.getLearningSubject(identity, subject.id)));
  const coreGroupIds = [...new Set(subjectDetails.flatMap((details) => details.groups.map((group) => group.id)))];
  const groupDetails = await Promise.all(coreGroupIds.map((groupId) => store.getGroup(identity, groupId)));
  const groups = groupDetails.map((details) => details.group);
  const users = [...new Map(groupDetails.flatMap((details) => details.students).map((student) => [student.id, student] as const)).values()];
  const params = await searchParams;

  return <>
    <PageHeader title="طلابي" description="طلاب Learning Core فقط. إنشاء الحساب منفصل عن العضوية، ويمكن إزالة الطالب وإعادة تسجيله لاحقًا بالمعرّف."/>
    <Notice {...params}/>
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="grid gap-6">
        <UserTable users={users} returnTo="/app/teacher/students"/>
        <Card>
          <CardTitle>عضويات المجموعات</CardTitle>
          <CardDescription>الإزالة توقف وصول الطالب إلى هذه المجموعة فقط ولا تعطل حسابه.</CardDescription>
          <div className="mt-5 grid gap-3">
            {groupDetails.some((details) => details.students.length) ? groupDetails.flatMap((details) =>
              details.students.map((student) => <div key={`${details.group.id}:${student.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4">
                <div><p className="font-bold">{student.displayName}</p><p className="text-xs text-[var(--muted)]">{details.group.name}</p></div>
                <form action={removeLearningStudentFormAction}>
                  <input type="hidden" name="groupId" value={details.group.id}/>
                  <input type="hidden" name="studentId" value={student.id}/>
                  <Button variant="danger" size="sm">إزالة من المجموعة</Button>
                </form>
              </div>)
            ) : <EmptyState title="لا توجد عضويات نشطة"/>}
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>طالب جديد</CardTitle>
        <CardDescription>ينشأ الحساب داخل مجموعة Learning Core تملكها فقط.</CardDescription>
        <div className="mt-5">
          {groups.length ? <CreateStudentForm groups={groups} returnTo="/app/teacher/students" teacherId={identity.userId}/> : <EmptyState title="أنشئ مجموعة داخل مادة أولًا"/>}
        </div>
      </Card>
    </div>
  </>;
}
