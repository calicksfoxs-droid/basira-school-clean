"use strict";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { clearAccessCodeFlash, readAccessCodeFlash, setAccessCodeFlash } from "@/lib/flash";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue(mockCookies as never);
});

describe("access-code flash", () => {
  it("stores an authenticated ciphertext and never the plaintext code", async () => {
    await setAccessCodeFlash("BSR-ABCD-12345678", "Test User");

    const [, value, options] = mockCookies.set.mock.calls[0];
    expect(value).not.toContain("BSR-ABCD-12345678");
    expect(Buffer.from(value, "base64url").toString("utf8")).not.toContain("BSR-ABCD-12345678");
    expect(options).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/app/access-code",
      maxAge: 300,
    });
  });

  it("decrypts a valid envelope", async () => {
    await setAccessCodeFlash("BSR-ABCD-12345678", "Test User");
    mockCookies.get.mockReturnValue({ value: mockCookies.set.mock.calls[0][1] });

    await expect(readAccessCodeFlash()).resolves.toEqual({
      code: "BSR-ABCD-12345678",
      displayName: "Test User",
    });
  });

  it("rejects a modified authenticated envelope", async () => {
    await setAccessCodeFlash("BSR-ABCD-12345678", "Test User");
    const bytes = Buffer.from(mockCookies.set.mock.calls[0][1], "base64url");
    bytes[bytes.length - 1] ^= 1;
    mockCookies.get.mockReturnValue({ value: bytes.toString("base64url") });

    await expect(readAccessCodeFlash()).resolves.toBeNull();
  });

  it("returns null for missing and malformed cookies", async () => {
    mockCookies.get.mockReturnValue(undefined);
    await expect(readAccessCodeFlash()).resolves.toBeNull();

    mockCookies.get.mockReturnValue({ value: "invalid-value" });
    await expect(readAccessCodeFlash()).resolves.toBeNull();
  });

  it("can explicitly clear the flash cookie", async () => {
    await clearAccessCodeFlash();
    expect(mockCookies.delete).toHaveBeenCalledWith("basira_access_code_flash");
  });
});
