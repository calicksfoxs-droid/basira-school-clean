"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageIcon, LoaderCircle } from "lucide-react";

export function UnitCoverUploader({ unitId, hasCover, editable }: { unitId: string; hasCover: boolean; editable: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setPending(true); setError("");
    const form = new FormData(); form.set("file", file);
    const response = await fetch(`/api/unit-covers/${unitId}`, { method: "POST", body: form });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setPending(false);
    if (!response.ok) { setError(result.error || "تعذر رفع الصورة"); return; }
    router.refresh();
  }
  return <div className="relative size-full">
    {hasCover ? <Image src={`/api/unit-covers/${unitId}`} alt="" fill unoptimized className="object-cover"/> : <div className="grid size-full place-items-center gap-2 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-white/10"><ImageIcon className="size-7"/></span><span className="text-xs font-bold text-white/75">مكان صورة الوحدة</span></div>}
    {editable && <><input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])}/><button type="button" onClick={() => input.current?.click()} disabled={pending} className="focus-ring absolute bottom-3 left-3 inline-flex min-h-9 items-center gap-2 rounded-xl bg-black/55 px-3 text-xs font-black text-white backdrop-blur hover:bg-black/70">{pending ? <LoaderCircle className="size-4 animate-spin"/> : <ImageIcon className="size-4"/>}{hasCover ? "تبديل الصورة" : "رفع صورة"}</button></>}
    {error && <span role="alert" className="absolute inset-x-3 bottom-14 rounded-xl bg-red-700/95 p-2 text-center text-[11px] font-bold text-white">{error}</span>}
  </div>;
}
