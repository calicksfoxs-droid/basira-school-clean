import { CreateSubjectForm } from "@/components/learning/create-subject-form";
import { SubjectGallery } from "@/components/learning/subject-gallery";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export default async function TeacherGradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = await requireRole("teacher");
  const details = await getLearningCoreStore().getCurriculumGrade(identity, id);
  return <div className="grid gap-6"><PageHeader title={details.grade.title} description={details.grade.description || "مواد هذا الصف"}/><div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]"><SubjectGallery identity={identity} subjects={details.subjects}/><Card className="xl:sticky xl:top-24"><CardTitle>إضافة مادة</CardTitle><CardDescription>ستُنشأ أربعة أقسام دراسية وثماني وحدات تلقائيًا.</CardDescription><CreateSubjectForm gradeId={details.grade.id}/></Card></div></div>;
}
