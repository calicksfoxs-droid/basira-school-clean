"use strict";

import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("access-code response hardening", () => {
  it("expires the reveal cookie and disables caching on the reveal page", async () => {
    vi.stubEnv("BASIRA_BACKEND", "demo");

    const response = await proxy(new NextRequest("http://localhost/app/access-code", {
      headers: { cookie: "basira_access_code_flash=encrypted" },
    }));

    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("set-cookie")).toContain("basira_access_code_flash=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("Path=/app/access-code");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("does not expire the flash cookie on unrelated pages", async () => {
    vi.stubEnv("BASIRA_BACKEND", "demo");

    const response = await proxy(new NextRequest("http://localhost/app/admin"));

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBeNull();
  });
});
