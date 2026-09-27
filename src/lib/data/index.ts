import "server-only";
import { isDemoBackend } from "@/lib/env";
import type { BasiraStore } from "./contracts";
import { RepairedDemoStore } from "./repaired-demo-store";
import { RepairedSupabaseStore } from "./repaired-supabase-store";

let demoStore: RepairedDemoStore | undefined;

export async function getStore(): Promise<BasiraStore> {
  if (isDemoBackend) return (demoStore ??= new RepairedDemoStore());
  return new RepairedSupabaseStore();
}
