import { GradeGallery } from "@/components/learning/grade-gallery";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export const metadata = { title: "صفوفي" };
export default async function StudentGradesPage() {
  const identity = await requireRole("student");
  const store = getLearningCoreStore();
  const [grades, subjects] = await Promise.all([store.listCurriculumGrades(identity), store.listLearningSubjects(identity)]);
  return <div className="grid gap-6"><PageHeader title="صفوفي" description="اختر صفك ثم افتح المادة التي تريد متابعتها."/><GradeGallery identity={identity} grades={grades} subjects={subjects}/></div>;
}
