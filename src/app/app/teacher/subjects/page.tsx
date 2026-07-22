import { redirect } from "next/navigation";
import { createLearningSubjectAction } from "@/actions/learning-core";
import { SubjectGallery, SubjectSummary } from "@/components/learning/subject-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export const metadata = { title: "موادي" };

export default async function TeacherSubjectsPage() {
  const identity = await requireRole("teacher");
  const subjects = await getLearningCoreStore().listLearningSubjects(identity);
  async function createSubject(formData: FormData) {
    "use server";
    const result = await createLearningSubjectAction(formData);
    if (result.ok) redirect(`/app/teacher/subjects/${result.data.id}`);
  }
  return <div className="grid gap-6"><PageHeader title="موادي" description="أنشئ المادة مرة واحدة، ثم نظّم داخلها المجموعات والوحدات والدروس."/><SubjectSummary subjects={subjects}/><div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]"><SubjectGallery identity={identity} subjects={subjects}/><Card className="xl:sticky xl:top-24"><CardTitle>أنشئ مادة جديدة</CardTitle><CardDescription>يمكنك إضافة المجموعات والوحدات بعد الحفظ.</CardDescription><form action={createSubject} className="mt-5 grid gap-4"><Field label="اسم المادة"><Input name="title" required placeholder="مثال: الرياضيات"/></Field><Field label="وصف مختصر"><Textarea name="description" placeholder="ماذا سيتعلم الطالب؟"/></Field><Button>حفظ المادة</Button></form></Card></div></div>;
}
