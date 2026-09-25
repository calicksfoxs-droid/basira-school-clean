import Link from "next/link";
export function StatGrid({ items }: { items: Array<{ label: string; value: number; href?: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const content = (
          <>
            <strong className="text-2xl font-black text-[var(--text)]">{item.value}</strong>
            <span className="text-sm font-bold text-[var(--muted)]">{item.label}</span>
          </>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="focus-ring flex min-h-24 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:-translate-y-0.5 hover:bg-[var(--soft)] card-shadow"
          >
            {content}
          </Link>
        ) : (
          <div
            key={item.label}
            className="flex min-h-24 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 card-shadow"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
