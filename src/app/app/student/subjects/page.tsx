import { SubjectGallery } from "@/components/learning/subject-gallery";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export const metadata = { title: "موادي" };
export default async function StudentSubjectsPage() { const identity = await requireRole("student"); const subjects = await getLearningCoreStore().listLearningSubjects(identity); return <div className="grid gap-6"><PageHeader title="موادي" description="لا تظهر لك إلا المواد والمجموعات التي سجّلك المعلم فيها."/><SubjectGallery identity={identity} subjects={subjects}/></div>; }
