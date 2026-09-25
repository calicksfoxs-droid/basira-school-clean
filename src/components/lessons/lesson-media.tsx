"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Download, FileText, PlayCircle, X } from "lucide-react";
import type { Asset } from "@/domain/models";
import { Button } from "@/components/ui/button";

export function LessonVideo({ asset, poster }: { asset: Asset; poster: string }) {
  const [failed, setFailed] = useState(false);
  return <div>
    <video aria-label={asset.title} controls playsInline preload="metadata" poster={poster} className="aspect-video w-full bg-[#0c1427]" src={`/api/files/${asset.id}`} onError={() => setFailed(true)}/>
    <div className="flex items-center gap-3 p-5"><PlayCircle className="size-5 shrink-0 text-[var(--accent)]"/><span className="min-w-0"><strong className="block text-sm" dir="auto">{asset.title}</strong><small className="text-[var(--muted)]">شاهد بالوتيرة المناسبة لك باستخدام أدوات المشغّل</small></span></div>
    {failed && <p role="alert" className="px-5 pb-5 text-sm text-[var(--danger)]">تعذر تشغيل الفيديو. <a className="underline" href={`/api/files/${asset.id}`} target="_blank" rel="noreferrer">فتح الفيديو في نافذة مستقلة</a></p>}
  </div>;
}

export function HandoutMedia({ asset, cover }: { asset: Asset; cover: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const response = await fetch(`/api/files/${asset.id}`, { signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (!blob.type.includes("application/pdf")) throw new Error("unsupported");
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch { if (!controller.signal.aborted) setError(true); }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, asset.id]);
  return <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]">
    <div className="grid sm:grid-cols-[180px_1fr]">
      <div className="relative grid min-h-44 place-items-center overflow-hidden bg-[#172748]">
        <Image src={cover} alt="" fill sizes="180px" className="object-cover opacity-35"/>
        <span className="relative grid h-28 w-20 place-items-center rounded-lg border border-white/30 bg-white/95 text-[#3449ad] shadow-xl"><span className="grid justify-items-center gap-2"><FileText className="size-9"/><strong className="text-xs">PDF</strong></span></span>
      </div>
      <div className="grid content-center gap-3 p-5 sm:p-6"><span className="text-xs font-bold text-[var(--accent)]">ملازم الدرس · PDF</span><h3 className="font-heading text-lg font-bold" dir="auto">{asset.title}</h3><p className="text-xs text-[var(--muted)]">{new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(asset.sizeBytes / 1024 / 1024)} ميغابايت · للمراجعة مع الدرس</p>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => { setUrl(undefined); setError(false); setOpen(!open); }}>{open ? <><X className="size-4"/> إغلاق القراءة</> : <><FileText className="size-4"/> قراءة الملزمة</>}</Button><a href={`/api/files/${asset.id}`} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-[var(--brand)]"><Download className="size-4"/> فتح / تنزيل PDF</a></div>
      </div>
    </div>
    {open && <div className="border-t border-[var(--border)] p-4">
      <p className="mb-3 text-xs leading-6 text-[var(--muted)]">إذا لم يدعم جهازك العرض المضمّن، استخدم «فتح / تنزيل PDF».</p>
      {error ? <p role="alert" className="p-5 text-sm text-[var(--danger)]">تعذر عرض الملف هنا. يمكنك محاولة فتحه مباشرة.</p> : url ? <iframe title={`قراءة ${asset.title}`} src={url} className="h-[65vh] min-h-80 w-full rounded-xl border-0 bg-white"/> : <div role="status" className="grid h-60 animate-pulse place-items-center rounded-xl bg-[var(--soft)] text-sm">جارٍ تجهيز الملزمة…</div>}
    </div>}
  </section>;
}
