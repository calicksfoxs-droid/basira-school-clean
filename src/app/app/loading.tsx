export default function Loading() {
  return <div aria-label="جارٍ تحميل الصفحة" aria-busy="true" className="grid gap-6"><div className="h-20 animate-pulse rounded-2xl bg-[var(--soft)]"/><div className="grid gap-4 sm:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[20px] border border-[var(--border)] bg-[var(--surface)]"/>)}</div><div className="h-72 animate-pulse rounded-[24px] border border-[var(--border)] bg-[var(--surface)]"/></div>;
}
