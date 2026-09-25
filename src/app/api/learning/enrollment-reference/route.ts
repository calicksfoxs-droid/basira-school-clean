import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

const noStore = { "Cache-Control": "no-store, private, max-age=0" };

export async function GET() {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: "انتهت الجلسة. سجّل الدخول مرة أخرى." }, { status: 401, headers: noStore });
  if (identity.role !== "student") return NextResponse.json({ error: "غير مسموح" }, { status: 403, headers: noStore });
  const metadata = await getLearningCoreStore().getOwnEnrollmentReference(identity);
  return NextResponse.json(metadata ?? null, { headers: noStore });
}

export async function POST() {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: "انتهت الجلسة. سجّل الدخول مرة أخرى." }, { status: 401, headers: noStore });
  if (identity.role !== "student") return NextResponse.json({ error: "غير مسموح" }, { status: 403, headers: noStore });
  const revealed = await getLearningCoreStore().rotateEnrollmentReference(identity, identity.userId);
  return NextResponse.json(revealed, { headers: noStore });
}
