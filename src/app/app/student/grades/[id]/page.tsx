import { SubjectGallery } from "@/components/learning/subject-gallery";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export default async function StudentGradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = await requireRole("student");
  const details = await getLearningCoreStore().getCurriculumGrade(identity, id);
  return <div className="grid gap-6"><PageHeader title={details.grade.title} description={details.grade.description || "مواد صفك"}/><SubjectGallery identity={identity} subjects={details.subjects}/></div>;
}
