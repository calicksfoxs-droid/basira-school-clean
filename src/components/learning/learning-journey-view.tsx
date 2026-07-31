import Image from "next/image";
import Link from "next/link";
import { Check, Lock, Play } from "lucide-react";
import type { LearningJourneyNode, LearningSubjectDetails } from "@/domain/core-models";
import { completeLearningLessonFormAction as completeLearningLessonAction } from "@/actions/learning-core";
import { Button } from "@/components/ui/button";
import { subjectCoverPath } from "@/lib/subject-covers";

export function LearningJourneyView({ details, nodes, selectedLessonId }: { details: LearningSubjectDetails; nodes: LearningJourneyNode[]; selectedLessonId?: string }) {
  const lessons = new Map(details.lessons.map((lesson) => [lesson.id, lesson]));
  const selected = selectedLessonId ? lessons.get(selectedLessonId) : undefined;
  return <div className="journey-page -m-4 min-h-[calc(100vh-80px)] overflow-hidden bg-[#170b35] text-white sm:-m-6 lg:-m-8">
    <header className="relative min-h-72 overflow-hidden border-b border-white/10">
      <Image src={subjectCoverPath(details.subject)} alt={`رحلة تعلم ${details.subject.title}`} fill priority sizes="100vw" className="object-cover opacity-65"/>
      <div className="absolute inset-0 bg-[#170b35]/45"/>
      <div className="relative flex min-h-72 flex-col justify-end p-7 sm:p-10"><span className="text-sm font-bold text-[#57e3d2]">رحلة {details.subject.title}</span><h1 className="font-heading mt-2 text-3xl font-bold sm:text-4xl">خطوات صغيرة تبني فهمًا كبيرًا</h1><p className="mt-3 max-w-xl text-white/70">اتبع المسار بالترتيب، وارجع لأي درس متاح عندما تحتاج إلى المراجعة.</p></div>
    </header>
    <div className="mx-auto grid max-w-3xl gap-0 px-5 py-12">
      {nodes.length ? nodes.map((node, index) => {
        const lesson = lessons.get(node.lessonId);
        const state = node.state;
        return <div key={node.lessonId} className="relative grid grid-cols-[1fr_78px] items-center gap-5 pb-10">
          {index < nodes.length - 1 && <span className="absolute bottom-0 left-auto right-[38px] top-[72px] w-1 translate-x-1/2 bg-[#ffd64a]"/>}
          <div className="text-right"><span className="text-xs font-bold text-[#57e3d2]">المحطة {node.order}</span><h2 className="font-heading mt-1 text-lg font-bold">{lesson?.title || `الدرس ${node.order}`}</h2><p className="mt-1 text-sm text-white/55">{lesson?.description || "خطوة جديدة في رحلة الفهم"}</p></div>
          <Link href={state === "locked" ? "#" : `/app/student/subjects/${details.subject.id}/journey?lesson=${node.lessonId}`} aria-disabled={state === "locked"} className={`focus-ring relative z-10 grid size-[76px] place-items-center rounded-full border-2 text-lg font-black ${state === "completed" ? "border-[#ffd64a] bg-[#19aa78]" : state === "available" ? "border-[#ffd64a] bg-[#ff5b79]" : "border-[#7a679f] bg-[#2b1459] text-white/55"}`}>
            {state === "completed" ? <Check/> : state === "locked" ? <Lock/> : <Play className="fill-current"/>}
          </Link>
        </div>;
      }) : <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><h2 className="font-heading text-xl font-bold">المسار قيد الإعداد</h2><p className="mt-2 text-white/60">ستظهر الدروس هنا بعد نشرها.</p></div>}
    </div>
    {selected && <aside className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl rounded-t-[28px] border border-white/10 bg-[#2b1459] p-6 shadow-2xl sm:bottom-6 sm:rounded-[28px]" role="dialog" aria-modal="true" aria-labelledby="journey-lesson-title">
      <Link href={`/app/student/subjects/${details.subject.id}/journey`} className="focus-ring absolute left-4 top-4 rounded-xl p-2 text-white/65" aria-label="إغلاق">×</Link>
      <span className="text-xs font-bold text-[#57e3d2]">الدرس المتاح الآن</span><h2 id="journey-lesson-title" className="font-heading mt-2 text-xl font-bold">{selected.title}</h2><p className="mt-2 text-sm leading-7 text-white/65">{selected.description || "ابدأ الدرس ثم عد إلى الرحلة لمتابعة تقدّمك."}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><Link href={`/app/student/lessons/${selected.id}`} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#20c7b5] font-black text-[#170b35]"><Play className="size-5 fill-current"/> فتح محتوى الدرس</Link><form action={completeLearningLessonAction}><input type="hidden" name="lessonId" value={selected.id}/><Button className="w-full bg-[#ffd64a] text-[#170b35] hover:bg-[#f3c83c]"><Check className="size-5"/> تسجيل الإكمال</Button></form></div>
    </aside>}
  </div>;
}
