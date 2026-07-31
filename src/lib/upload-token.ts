import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export interface UploadTokenPayload {
  userId: string;
  kind: "video" | "handout" | "aid" | "submission";
  lessonId?: string;
  lessonPartId?: string;
  submissionId?: string;
  ownerStudentId?: string;
  objectPath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  title: string;
  exp: number;
}

function secret() { return env.BASIRA_APP_SECRET; }
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
export function createUploadToken(payload: UploadTokenPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}
export function verifyUploadToken(token: string): UploadTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as UploadTokenPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}
