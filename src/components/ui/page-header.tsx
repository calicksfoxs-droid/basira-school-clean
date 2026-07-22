export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">{description}</p>}</div>{action}</header>;
}
