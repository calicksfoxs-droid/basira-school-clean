import "server-only";
import { isDemoBackend } from "@/lib/env";
import type { BasiraStore } from "./contracts";
import { DemoStore } from "./demo-store";
import { SupabaseStore } from "./supabase-store";

let demoStore: DemoStore | undefined;

export async function getStore(): Promise<BasiraStore> {
  if (isDemoBackend) return (demoStore ??= new DemoStore());
  return new SupabaseStore();
}
