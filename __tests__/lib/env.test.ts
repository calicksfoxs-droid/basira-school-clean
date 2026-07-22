"use strict";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseEnv } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

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

  it("should fail in production if BASIRA_APP_SECRET is default", () => {
    vi.stubEnv("NODE_ENV", "production");
    const source = {
      BASIRA_BACKEND: "demo",
      BASIRA_APP_SECRET: "basira-local-secret-change-before-production",
    };

    expect(() => parseEnv(source)).toThrow(
      "BASIRA_APP_SECRET must not be the default value in production"
    );
  });

  it("should fail in production if BASIRA_APP_SECRET is too short", () => {
    vi.stubEnv("NODE_ENV", "production");
    const source = {
      BASIRA_BACKEND: "demo",
      BASIRA_APP_SECRET: "short-secret",
    };

    expect(() => parseEnv(source)).toThrow(
      "BASIRA_APP_SECRET must be at least 32 characters long"
    );
  });

  it("should allow default BASIRA_APP_SECRET in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const source = {
      BASIRA_BACKEND: "demo",
      BASIRA_APP_SECRET: "basira-local-secret-change-before-production",
    };

    const parsed = parseEnv(source);
    expect(parsed.BASIRA_APP_SECRET).toBe(
      "basira-local-secret-change-before-production"
    );
  });
});
