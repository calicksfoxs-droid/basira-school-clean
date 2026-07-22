import { LearningJourneyView } from "@/components/learning/learning-journey-view";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export default async function JourneyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lesson?: string }> }) { const identity = await requireRole("student"); const { id } = await params; const { lesson } = await searchParams; const store = getLearningCoreStore(); const [details, nodes] = await Promise.all([store.getLearningSubject(identity, id), store.getLearningJourney(identity, id)]); return <LearningJourneyView details={details} nodes={nodes} selectedLessonId={lesson}/>; }
