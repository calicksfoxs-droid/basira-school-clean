import { CreateSubjectForm } from "@/components/learning/create-subject-form";
import { SubjectGallery, SubjectSummary } from "@/components/learning/subject-gallery";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export const metadata = { title: "موادي" };

export default async function TeacherSubjectsPage() {
  const identity = await requireRole("teacher");
  const subjects = await getLearningCoreStore().listLearningSubjects(identity);
  return <div className="grid gap-6"><PageHeader title="موادي" description="أنشئ المادة مرة واحدة، ثم نظّم داخلها المجموعات والوحدات والدروس."/><SubjectSummary subjects={subjects}/><div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]"><SubjectGallery identity={identity} subjects={subjects}/><Card className="xl:sticky xl:top-24"><CardTitle>أنشئ مادة جديدة</CardTitle><CardDescription>يمكنك إضافة المجموعات والوحدات بعد الحفظ.</CardDescription><CreateSubjectForm/></Card></div></div>;
}
