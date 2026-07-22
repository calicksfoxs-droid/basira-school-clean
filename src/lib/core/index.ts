import "server-only";
import { isDemoBackend } from "@/lib/env";
import { DemoLearningCoreStore } from "./demo-learning-core-store";
import { SupabaseLearningCoreStore } from "./supabase-learning-core-store";
import type { LearningCoreStore } from "./contracts";

let demoStore: LearningCoreStore | undefined;

export function getLearningCoreStore(): LearningCoreStore {
  if (isDemoBackend) return (demoStore ??= new DemoLearningCoreStore());
  return new SupabaseLearningCoreStore();
}
