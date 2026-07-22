import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

const noStore = { "Cache-Control": "no-store, private, max-age=0" };

export async function GET() {
  const identity = await requireRole("student");
  const metadata = await getLearningCoreStore().getOwnEnrollmentReference(identity);
  return NextResponse.json(metadata, { headers: noStore });
}

export async function POST() {
  const identity = await requireRole("student");
  const revealed = await getLearningCoreStore().rotateEnrollmentReference(identity, identity.userId);
  return NextResponse.json(revealed, { headers: noStore });
}
