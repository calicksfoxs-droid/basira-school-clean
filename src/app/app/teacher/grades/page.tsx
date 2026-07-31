import { GradeGallery } from "@/components/learning/grade-gallery";
import { CreateGradeForm } from "@/components/learning/create-grade-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export const metadata = { title: "صفوفي" };
export default async function TeacherGradesPage() {
  const identity = await requireRole("teacher");
  const store = getLearningCoreStore();
  const [grades, subjects] = await Promise.all([store.listCurriculumGrades(identity), store.listLearningSubjects(identity)]);
  return <div className="grid gap-6"><PageHeader title="صفوفي" description="أضف الصفوف التي تدرّسها، ثم رتّب مواد كل صف من مكان واحد."/><div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]"><GradeGallery identity={identity} grades={grades} subjects={subjects}/><Card className="xl:sticky xl:top-24"><CardTitle>إضافة صف</CardTitle><CardDescription>لن تظهر صفوف لا تحتاجها؛ أنت تحدد الصفوف التي تدرّسها.</CardDescription><CreateGradeForm/></Card></div></div>;
}
