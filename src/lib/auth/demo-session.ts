import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Identity, Role } from "@/domain/models";
import { env } from "@/lib/env";
import { readDemoDatabase } from "@/lib/demo/demo-db";

const COOKIE = "basira_demo_session";
const MAX_AGE = 60 * 60 * 8;

type Payload = Identity & { exp: number; iat: number };

function encode(input: string) {
  return Buffer.from(input).toString("base64url");
}
function sign(input: string) {
  return createHmac("sha256", env.BASIRA_APP_SECRET).update(input).digest("base64url");
}

export async function setDemoSession(identity: Identity) {
  const issuedAt = Date.now();
  const payload: Payload = { ...identity, iat: issuedAt, exp: issuedAt + MAX_AGE * 1000 };
  const encoded = encode(JSON.stringify(payload));
  const store = await cookies();
  store.set(COOKIE, `${encoded}.${sign(encoded)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getDemoSession(): Promise<Identity | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Payload;
    if (payload.exp < Date.now()) return null;
    if (!( ["admin", "teacher", "student"] as Role[]).includes(payload.role)) return null;
    const database = await readDemoDatabase();
    const user = database.users.find((item) => item.id === payload.userId);
    if (!user || user.status !== "active" || user.role !== payload.role) return null;
    const invalidBefore = user.sessionInvalidBefore ? new Date(user.sessionInvalidBefore).getTime() : 0;
    if (payload.iat < invalidBefore - 1000) return null;
    return { userId: user.id, displayName: user.displayName, role: user.role, status: user.status };
  } catch {
    return null;
  }
}

export async function clearDemoSession() {
  (await cookies()).delete(COOKIE);
}
