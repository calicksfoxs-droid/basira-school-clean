import { AppShell } from "@/components/layout/app-shell";
import { requireIdentity } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { const identity = await requireIdentity(); const store = getLearningCoreStore(); const [preferences, settings] = await Promise.all([store.getUserPreferences(identity), store.getPlatformSettings(identity)]); return <AppShell identity={identity} preferences={preferences} platformName={settings.platformName}>{children}</AppShell>; }
