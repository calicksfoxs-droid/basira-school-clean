"use strict";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { disableUserAction, resetAccessCodeAction } from "@/actions/accounts";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { setAccessCodeFlash } from "@/lib/flash";
import { redirect } from "next/navigation";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/data", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/flash", () => ({ setAccessCodeFlash: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const admin = { role: "admin", userId: "admin-id", displayName: "Admin", status: "active" } as const;
const mockStore = {
  disableUser: vi.fn(),
  resetAccessCode: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStore).mockResolvedValue(mockStore as never);
  vi.mocked(redirect).mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

function form() {
  const value = new FormData();
  value.set("userId", "student-id");
  value.set("returnTo", "/app/admin/students");
  return value;
}

describe("account credential actions", () => {
  it("requires the admin role before disabling an account", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("forbidden"));

    await expect(disableUserAction(form())).rejects.toThrow("NEXT_REDIRECT:");

    expect(requireRole).toHaveBeenCalledWith("admin");
    expect(getStore).not.toHaveBeenCalled();
    expect(mockStore.disableUser).not.toHaveBeenCalled();
  });

  it("allows an admin to disable an account", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(admin);
    mockStore.disableUser.mockResolvedValueOnce(undefined);

    await expect(disableUserAction(form())).rejects.toThrow("NEXT_REDIRECT:");

    expect(mockStore.disableUser).toHaveBeenCalledWith(admin, "student-id");
  });

  it("requires the admin role before resetting an access code", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("forbidden"));

    await expect(resetAccessCodeAction(form())).rejects.toThrow("NEXT_REDIRECT:");

    expect(requireRole).toHaveBeenCalledWith("admin");
    expect(getStore).not.toHaveBeenCalled();
    expect(mockStore.resetAccessCode).not.toHaveBeenCalled();
    expect(setAccessCodeFlash).not.toHaveBeenCalled();
  });

  it("allows an admin to reset a code and stores only an encrypted flash", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(admin);
    mockStore.resetAccessCode.mockResolvedValueOnce({
      code: "BSR-ABCD-12345678",
      user: { displayName: "Student" },
    });

    await expect(resetAccessCodeAction(form())).rejects.toThrow("NEXT_REDIRECT:/app/access-code");

    expect(mockStore.resetAccessCode).toHaveBeenCalledWith(admin, "student-id");
    expect(setAccessCodeFlash).toHaveBeenCalledWith("BSR-ABCD-12345678", "Student");
  });
});
