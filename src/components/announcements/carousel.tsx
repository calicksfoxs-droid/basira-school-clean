"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Megaphone, Pause, Play } from "lucide-react";
import type { Announcement } from "@/domain/models";

export function AnnouncementCarousel({ items }: { items: Announcement[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;
  useEffect(() => {
    if (paused || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 5000);
    return () => window.clearInterval(timer);
  }, [paused, count]);
  if (!count) return null;
  const item = items[index];
  return <section aria-roledescription="carousel" aria-label="الإعلانات" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-l from-[#0b1d33] to-[#1479b8] p-5 text-white card-shadow soft-enter">
    <div className="absolute -left-10 -top-12 size-40 rounded-full bg-cyan-300/10"/>
    <div className="relative flex min-h-28 items-center gap-4">
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/12"><Megaphone className="size-6"/></div>
      <div className="min-w-0 flex-1"><p className="text-xs font-bold text-cyan-100">إعلان مهم</p><h2 className="mt-1 text-xl font-black">{item.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-7 text-white/80">{item.body}</p>{item.ctaPath && item.ctaLabel && <Link href={item.ctaPath} className="focus-ring mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-black text-[#0b1d33]">{item.ctaLabel}</Link>}</div>
    </div>
    {count > 1 && <div className="relative mt-4 flex items-center justify-between"><div className="flex gap-1.5">{items.map((entry, dot) => <button key={entry.id} aria-label={`الإعلان ${dot + 1}`} onClick={() => setIndex(dot)} className={`focus-ring h-2 rounded-full transition-all ${dot === index ? "w-7 bg-white" : "w-2 bg-white/40"}`}/>)}</div><div className="flex gap-1"><button className="focus-ring rounded-lg p-2 hover:bg-white/10" aria-label={paused ? "تشغيل" : "إيقاف مؤقت"} onClick={() => setPaused((value) => !value)}>{paused ? <Play className="size-4"/> : <Pause className="size-4"/>}</button><button className="focus-ring rounded-lg p-2 hover:bg-white/10" aria-label="السابق" onClick={() => setIndex((index - 1 + count) % count)}><ChevronRight className="size-4"/></button><button className="focus-ring rounded-lg p-2 hover:bg-white/10" aria-label="التالي" onClick={() => setIndex((index + 1) % count)}><ChevronLeft className="size-4"/></button></div></div>}
  </section>;
}
