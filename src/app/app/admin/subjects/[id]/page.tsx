import { LearningSubjectView } from "@/components/learning/learning-subject-view";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export default async function AdminSubjectPage({ params }: { params: Promise<{ id: string }> }) { const identity = await requireRole("admin"); const { id } = await params; const details = await getLearningCoreStore().getLearningSubject(identity, id); return <LearningSubjectView identity={identity} details={details}/>; }
