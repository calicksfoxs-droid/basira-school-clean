import { Inbox } from "lucide-react";
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><Inbox className="mb-3 size-9 text-slate-400"/><h3 className="font-black">{title}</h3>{description && <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}
