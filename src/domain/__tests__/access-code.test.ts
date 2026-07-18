import { describe, expect, it } from "vitest";
import { hashSecret, parseAccessCode, verifySecret } from "@/lib/demo/demo-db";

describe("access codes", () => {
  it("parses the locked format", () => {
    expect(parseAccessCode("bsr-ab12-cdef3456")).toEqual({ publicRef: "AB12", secret: "CDEF3456" });
    expect(parseAccessCode("bad")).toBeNull();
  });
  it("hashes without storing plaintext", () => {
    const hash = hashSecret("SECRET12");
    expect(hash).not.toContain("SECRET12");
    expect(verifySecret("SECRET12", hash)).toBe(true);
    expect(verifySecret("WRONG123", hash)).toBe(false);
  });
});
