import { describe, expect, it } from "vitest";
import {
  generateEnrollmentReference,
  parseEnrollmentReference,
  normalizeEnrollmentReference,
  maskEnrollmentReference,
  fingerprintEnrollmentReference,
  verifyEnrollmentReference,
} from "../enrollment-reference";

describe("enrollment-reference", () => {
  describe("generateEnrollmentReference", () => {
    it("generates a reference matching BSR-S-[A-Z2-9]{12}", () => {
      const reference = generateEnrollmentReference();
      expect(reference).toMatch(/^BSR-S-[A-Z2-9]{12}$/);
    });

    it("generates unique references", () => {
      const reference1 = generateEnrollmentReference();
      const reference2 = generateEnrollmentReference();
      expect(reference1).not.toBe(reference2);
    });
  });

  describe("parseEnrollmentReference", () => {
    it("returns null for invalid input", () => {
      expect(parseEnrollmentReference(null)).toBeNull();
      expect(parseEnrollmentReference(undefined)).toBeNull();
      expect(parseEnrollmentReference(123)).toBeNull();
      expect(parseEnrollmentReference("invalid")).toBeNull();
      expect(parseEnrollmentReference("BSR-S-ABCDEFGHIJKL")).toBeNull();
      expect(parseEnrollmentReference("BSR-S-ABCDEFGH1JKL")).toBeNull();
      expect(parseEnrollmentReference("BSR-S-ABCDEFGH0JKL")).toBeNull();
      expect(parseEnrollmentReference("BSR-S-ABCDEFGHJK")).toBeNull();
      expect(parseEnrollmentReference("BSR-S-ABCDEFGHJKLMN")).toBeNull();
      expect(parseEnrollmentReference("BSR-X-ABCDEFGHJKLM")).toBeNull();
    });

    it("normalizes valid input", () => {
      expect(parseEnrollmentReference("bsr-s-abcdefghjklm")).toBe("BSR-S-ABCDEFGHJKLM");
    });
  });

  describe("normalizeEnrollmentReference", () => {
    it("throws for invalid input", () => {
      expect(() => normalizeEnrollmentReference("invalid")).toThrow("Invalid reference");
    });

    it("normalizes valid input", () => {
      expect(normalizeEnrollmentReference("bsr-s-abcdefghjklm")).toBe("BSR-S-ABCDEFGHJKLM");
    });
  });

  describe("maskEnrollmentReference", () => {
    it("throws for invalid input", () => {
      expect(() => maskEnrollmentReference("invalid")).toThrow("Invalid reference");
    });

    it("masks a reference correctly", () => {
      const reference = "BSR-S-ABCDEFGHJKLM";
      expect(maskEnrollmentReference(reference)).toBe("BSR-S-****JKLM");
    });
  });

  describe("fingerprintEnrollmentReference", () => {
    it("throws for invalid input", () => {
      expect(() => fingerprintEnrollmentReference("invalid")).toThrow("Invalid reference");
    });

    it("generates a deterministic SHA-256 fingerprint", () => {
      const reference = "BSR-S-ABCDEFGHJKLM";
      const fingerprint = fingerprintEnrollmentReference(reference);
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(fingerprintEnrollmentReference(reference)).toBe(fingerprint);
    });
  });

  describe("verifyEnrollmentReference", () => {
    it("returns false for invalid fingerprint", () => {
      const reference = "BSR-S-ABCDEFGHJKLM";
      expect(verifyEnrollmentReference(reference, "invalid")).toBe(false);
      expect(verifyEnrollmentReference(reference, "")).toBe(false);
      expect(verifyEnrollmentReference(reference, "123")).toBe(false);
    });

    it("returns true for matching reference and fingerprint", () => {
      const reference = "BSR-S-ABCDEFGHJKLM";
      const fingerprint = fingerprintEnrollmentReference(reference);
      expect(verifyEnrollmentReference(reference, fingerprint)).toBe(true);
    });

    it("returns false for non-matching reference and fingerprint", () => {
      const reference = "BSR-S-ABCDEFGHJKLM";
      const fingerprint = fingerprintEnrollmentReference("BSR-S-ABCDEFGHJKLN");
      expect(verifyEnrollmentReference(reference, fingerprint)).toBe(false);
    });

    it("returns false for invalid reference", () => {
      const fingerprint = fingerprintEnrollmentReference("BSR-S-ABCDEFGHJKLM");
      expect(verifyEnrollmentReference("invalid", fingerprint)).toBe(false);
    });
  });
});