import "server-only";
import { cookies } from "next/headers";

const CODE_COOKIE = "basira_access_code_flash";

export async function setAccessCodeFlash(code: string, displayName: string) {
  (await cookies()).set(CODE_COOKIE, Buffer.from(JSON.stringify({ code, displayName })).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/app/access-code",
    maxAge: 300,
  });
}

export async function readAccessCodeFlash(): Promise<{ code: string; displayName: string } | null> {
  const raw = (await cookies()).get(CODE_COOKIE)?.value;
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { code: string; displayName: string }; }
  catch { return null; }
}

export async function clearAccessCodeFlash() { (await cookies()).delete(CODE_COOKIE); }
