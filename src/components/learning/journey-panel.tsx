"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function JourneyPanel({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-labelledby="journey-lesson-title" className="confirmation-dialog journey-dialog" onCancel={(event) => { event.preventDefault(); router.push(closeHref); }}>{children}</dialog>;
}
