import { LearningSubjectView } from "@/components/learning/learning-subject-view";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export default async function StudentSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requireRole("student");
  const { id } = await params;
  const details = await getLearningCoreStore().getLearningSubject(identity, id);
  return <LearningSubjectView identity={identity} details={details}/>;
}
