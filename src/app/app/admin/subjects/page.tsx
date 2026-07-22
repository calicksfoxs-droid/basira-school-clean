import { SubjectGallery, SubjectSummary } from "@/components/learning/subject-gallery";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export const metadata = { title: "المواد" };
export default async function AdminSubjectsPage() { const identity = await requireRole("admin"); const subjects = await getLearningCoreStore().listLearningSubjects(identity); return <div className="grid gap-6"><PageHeader title="المواد" description="رؤية رقابية للمواد المستقلة المنشأة بواسطة المعلمين."/><SubjectSummary subjects={subjects}/><SubjectGallery identity={identity} subjects={subjects}/></div>; }
