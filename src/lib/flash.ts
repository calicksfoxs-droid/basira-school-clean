import "server-only";
import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const CODE_COOKIE = "basira_access_code_flash";
const ENVELOPE_VERSION = 1;
const ENCRYPTION_KEY = createHash("sha256").update(env.BASIRA_APP_SECRET, "utf8").digest();

export async function setAccessCodeFlash(code: string, displayName: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const payload = JSON.stringify({ code, displayName });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const cookieValue = Buffer.concat([Buffer.from([ENVELOPE_VERSION]), iv, authTag, encrypted]).toString("base64url");

  (await cookies()).set(CODE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/app/access-code",
    maxAge: 300,
  });
}

export async function readAccessCodeFlash(): Promise<{ code: string; displayName: string } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CODE_COOKIE)?.value;
  if (!raw) return null;

  try {
    const buffer = Buffer.from(raw, "base64url");
    if (buffer.length < 30 || buffer[0] !== ENVELOPE_VERSION) return null;

    const iv = buffer.subarray(1, 13);
    const authTag = buffer.subarray(13, 29);
    const encrypted = buffer.subarray(29);

    const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    const payload = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");

    const value: unknown = JSON.parse(payload);
    if (
      !value ||
      typeof value !== "object" ||
      typeof (value as { code?: unknown }).code !== "string" ||
      typeof (value as { displayName?: unknown }).displayName !== "string"
    ) return null;
    return value as { code: string; displayName: string };
  } catch {
    return null;
  }
}

export async function clearAccessCodeFlash() {
  (await cookies()).delete(CODE_COOKIE);
}
