"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import { FileText, Lightbulb, UploadCloud, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type UploadKind = "video" | "handout" | "aid";
export function UploadPanel({ lessonId, lessonPartId, kind }: { lessonId: string; lessonPartId?: string; kind: UploadKind }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const Icon = kind === "video" ? Video : kind === "aid" ? Lightbulb : FileText;
  const label = kind === "video" ? "فيديو الدرس" : kind === "aid" ? "المساعدات" : "ملزمة الدرس";
  async function upload(file: File) {
    setBusy(true); setError(undefined); setProgress(0);
    try {
      const authorization = await fetch("/api/uploads/authorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId, lessonPartId, kind, fileName: file.name, mimeType: file.type, sizeBytes: file.size, title: file.name }) });
      const setup = await authorization.json() as { error?: string; mode?: "demo" | "supabase"; token?: string; bucket?: string; objectPath?: string; storageUrl?: string };
      if (!authorization.ok || !setup.token || !setup.mode) throw new Error(setup.error || "تعذر تجهيز الرفع");
      if (setup.mode === "demo") {
        const formData = new FormData(); formData.set("file", file); formData.set("token", setup.token);
        const response = await fetch("/api/uploads/demo", { method: "POST", body: formData });
        if (!response.ok) throw new Error((await response.json()).error || "فشل الرفع");
        setProgress(100);
      } else {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !setup.storageUrl || !setup.bucket || !setup.objectPath) throw new Error("جلسة الدخول غير متاحة");
        await new Promise<void>((resolve, reject) => {
          const uploader = new tus.Upload(file, {
            endpoint: `${setup.storageUrl}/storage/v1/upload/resumable`, retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: { authorization: `Bearer ${session.access_token}`, "x-upsert": "false" }, uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true, metadata: { bucketName: setup.bucket!, objectName: setup.objectPath!, contentType: file.type, cacheControl: "3600" }, chunkSize: 6 * 1024 * 1024,
            onError: reject, onProgress: (uploaded, total) => setProgress(Math.round((uploaded / total) * 100)), onSuccess: () => resolve(),
          });
          uploader.findPreviousUploads().then((previous) => { if (previous[0]) uploader.resumeFromPreviousUpload(previous[0]); uploader.start(); }).catch(reject);
        });
      }
      const finalize = await fetch("/api/uploads/finalize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: setup.token }) });
      if (!finalize.ok) throw new Error((await finalize.json()).error || "تعذر اعتماد الملف");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "فشل الرفع"); }
    finally { setBusy(false); }
  }
  return <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--soft)] p-5"><input ref={input} type="file" hidden accept={kind === "video" ? "video/mp4,video/webm" : "application/pdf,image/jpeg,image/png,image/webp"} onChange={(event) => { const file=event.target.files?.[0]; if(file) void upload(file); }}/><div className="flex flex-wrap items-center gap-4"><div className="grid size-12 place-items-center rounded-xl bg-[var(--surface)] text-[var(--brand)] shadow-sm"><Icon className="size-6"/></div><div className="min-w-0 flex-1"><p className="font-black">{label}</p><p className="mt-1 text-xs text-[var(--muted)]">{kind === "video" ? "يدعم MP4 وWebM مع رفع قابل للاستكمال." : "يدعم PDF وصور JPG وPNG وWebP، والاستبدال آمن."}</p>{progress !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full bg-[var(--brand)] transition-all" style={{ width: `${progress}%` }}/></div>}{error && <p className="mt-2 flex items-center gap-1 text-xs font-bold text-red-600"><XCircle className="size-4"/>{error}</p>}</div><Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.click()}><UploadCloud className="size-4"/>{busy ? `جارٍ الرفع ${progress ?? 0}%` : "اختيار ملف"}</Button></div></div>;
}
