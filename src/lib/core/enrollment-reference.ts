import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "BSR-S-";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERENCE_LENGTH = 12;
const MASKED_SUFFIX_LENGTH = 4;

function isValidEnrollmentReference(reference: unknown): reference is string {
  return typeof reference === "string" &&
    new RegExp(`^${PREFIX}[${ALPHABET}]{${REFERENCE_LENGTH}}$`).test(reference.trim().toUpperCase());
}

export function parseEnrollmentReference(reference: unknown): string | null {
  if (!isValidEnrollmentReference(reference)) return null;
  return reference.trim().toUpperCase();
}

export function normalizeEnrollmentReference(reference: string): string {
  const parsed = parseEnrollmentReference(reference);
  if (!parsed) throw new Error("Invalid reference");
  return parsed;
}

export function generateEnrollmentReference(): string {
  const buffer = randomBytes(REFERENCE_LENGTH);
  let result = PREFIX;

  for (let i = 0; i < REFERENCE_LENGTH; i++) {
    result += ALPHABET[buffer[i] & 31];
  }

  return result;
}

export function maskEnrollmentReference(reference: string): string {
  const parsed = parseEnrollmentReference(reference);
  if (!parsed) throw new Error("Invalid reference");
  return `${PREFIX}****${parsed.slice(-MASKED_SUFFIX_LENGTH)}`;
}

export function fingerprintEnrollmentReference(reference: string): string {
  const parsed = parseEnrollmentReference(reference);
  if (!parsed) throw new Error("Invalid reference");
  return createHash("sha256").update(parsed).digest("hex");
}

export function verifyEnrollmentReference(reference: string, expectedFingerprint: string): boolean {
  if (typeof expectedFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) return false;
  const parsed = parseEnrollmentReference(reference);
  if (!parsed) return false;
  const actualFingerprint = fingerprintEnrollmentReference(reference);
  const expectedBytes = Buffer.from(expectedFingerprint, "hex");
  const actualBytes = Buffer.from(actualFingerprint, "hex");
  return timingSafeEqual(expectedBytes, actualBytes);
}