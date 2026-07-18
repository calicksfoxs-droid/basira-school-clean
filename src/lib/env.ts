import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  BASIRA_BACKEND: z.enum(["demo", "supabase"]).default("demo"),
  BASIRA_APP_SECRET: z.string().min(32).default("basira-local-secret-change-before-production"),
  BASIRA_DEMO_DB_PATH: z.string().default(".data/basira-demo.json"),
  BASIRA_DEMO_UPLOAD_DIR: z.string().default(".data/uploads"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  MAX_VIDEO_UPLOAD_MB: z.coerce.number().positive().default(250),
  MAX_HANDOUT_UPLOAD_MB: z.coerce.number().positive().default(25),
  MAX_SUBMISSION_UPLOAD_MB: z.coerce.number().positive().default(20),
});

export const env = serverSchema.parse({
  BASIRA_BACKEND: process.env.BASIRA_BACKEND,
  BASIRA_APP_SECRET: process.env.BASIRA_APP_SECRET ?? process.env.BASIRA_DEMO_SESSION_SECRET,
  BASIRA_DEMO_DB_PATH: process.env.BASIRA_DEMO_DB_PATH,
  BASIRA_DEMO_UPLOAD_DIR: process.env.BASIRA_DEMO_UPLOAD_DIR,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  MAX_VIDEO_UPLOAD_MB: process.env.MAX_VIDEO_UPLOAD_MB,
  MAX_HANDOUT_UPLOAD_MB: process.env.MAX_HANDOUT_UPLOAD_MB,
  MAX_SUBMISSION_UPLOAD_MB: process.env.MAX_SUBMISSION_UPLOAD_MB,
});

export const isDemoBackend = env.BASIRA_BACKEND === "demo";
export const isSupabaseBackend = env.BASIRA_BACKEND === "supabase";

export function getSupabaseEnv() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are incomplete");
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

