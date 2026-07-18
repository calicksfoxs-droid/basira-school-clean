import { AppShell } from "@/components/layout/app-shell";
import { requireIdentity } from "@/lib/auth";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { const identity = await requireIdentity(); return <AppShell identity={identity}>{children}</AppShell>; }
