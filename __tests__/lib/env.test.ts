"use strict";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseEnv } from "@/lib/env";

describe("Environment parsing", () => {
  it("should normalize blank Supabase values to undefined in demo mode", () => {
    const source = {
      BASIRA_BACKEND: "demo",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    };

    const parsed = parseEnv(source);
    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
    expect(parsed.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(parsed.BASIRA_BACKEND).toBe("demo");
  });

  it("should fail fast with validation for missing Supabase values in supabase mode", () => {
    const source = {
      BASIRA_BACKEND: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    };

    expect(() => parseEnv(source)).toThrow(z.ZodError);
  });

  it("should allow valid Supabase values in supabase mode", () => {
    const source = {
      BASIRA_BACKEND: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.com",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    };

    const parsed = parseEnv(source);
    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.com");
    expect(parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("anon-key");
    expect(parsed.SUPABASE_SERVICE_ROLE_KEY).toBe("service-key");
    expect(parsed.BASIRA_BACKEND).toBe("supabase");
  });
});
