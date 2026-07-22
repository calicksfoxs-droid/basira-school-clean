import Image from "next/image";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="grid place-items-center rounded-[22px] border border-dashed border-[var(--border)] bg-[var(--canvas)] px-6 py-9 text-center"><div className="relative mb-4 aspect-[4/3] w-36 overflow-hidden rounded-2xl"><Image src="/images/basira/empty-state-spectrum-v1.png" alt="" fill sizes="144px" className="object-cover"/></div><h3 className="font-heading font-bold text-[var(--text)]">{title}</h3>{description && <p className="mt-2 max-w-md text-sm leading-7 text-[var(--muted)]">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}
