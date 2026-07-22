import { Compass } from "lucide-react";
import { SubjectGallery } from "@/components/learning/subject-gallery";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export const metadata = { title: "رحلتي" };
export default async function StudentJourneyIndexPage() { const identity = await requireRole("student"); const subjects = await getLearningCoreStore().listLearningSubjects(identity); return <div className="grid gap-6"><PageHeader title="رحلتي" description="اختر مادة لتتابع دروسها كمسار تعلّم واضح." action={<span className="grid size-12 place-items-center rounded-2xl bg-[#2b1459] text-[#ffd64a]"><Compass/></span>}/><SubjectGallery identity={identity} subjects={subjects}/></div>; }
