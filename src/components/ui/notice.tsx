export function Notice({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error ?? message}</div>;
}
