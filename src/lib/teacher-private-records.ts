import "server-only";

import { randomUUID } from "node:crypto";
import type { Identity } from "@/domain/models";
import { mutateDemoDatabase, readDemoDatabase } from "@/lib/demo/demo-db";
import { isDemoBackend } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { assertAllowed, assertFound } from "@/lib/data/errors";

export interface TeacherPrivateEnrollmentRecord {
  groupId: string;
  groupName: string;
  studentId: string;
  studentName: string;
  contactNumber?: string;
  amountNote?: string;
  paymentNote?: string;
  updatedAt?: string;
}

export interface TeacherFinanceInput {
  groupId: string;
  studentId: string;
  amountNote?: string;
  paymentNote?: string;
}

function cleanOptional(value: string | undefined, maxLength: number) {
  const cleaned = value?.trim().slice(0, maxLength);
  return cleaned || undefined;
}

export function normalizeTeacherFinanceInput(input: TeacherFinanceInput): TeacherFinanceInput {
  return {
    groupId: input.groupId.trim(),
    studentId: input.studentId.trim(),
    amountNote: cleanOptional(input.amountNote, 80),
    paymentNote: cleanOptional(input.paymentNote, 300),
  };
}

function assertTeacher(identity: Identity) {
  assertAllowed(identity.role === "teacher" && identity.status === "active", "هذه البيانات خاصة بالمعلم فقط");
}

export async function listTeacherPrivateEnrollmentRecords(identity: Identity): Promise<TeacherPrivateEnrollmentRecord[]> {
  assertTeacher(identity);

  if (isDemoBackend) {
    const db = await readDemoDatabase();
    const subjectIds = new Set(db.learningSubjects
      .filter((subject) => subject.teacherId === identity.userId)
      .map((subject) => subject.id));
    const groups = db.learningGroups.filter((group) => group.status === "active" && subjectIds.has(group.subjectId));
    const groupMap = new Map(groups.map((group) => [group.id, group]));
    const memberships = db.learningMemberships.filter((membership) =>
      membership.status === "active" && groupMap.has(membership.groupId));
    const userMap = new Map(db.users.map((user) => [user.id, user]));
    const privateMap = new Map(db.privateRecords
      .filter((record) => record.teacherId === identity.userId)
      .map((record) => [`${record.groupId}:${record.studentId}`, record]));

    return memberships.flatMap((membership) => {
      const group = groupMap.get(membership.groupId);
      const student = userMap.get(membership.studentId);
      if (!group || !student || student.role !== "student") return [];
      const privateRecord = privateMap.get(`${membership.groupId}:${membership.studentId}`);
      return [{
        groupId: group.id,
        groupName: group.name,
        studentId: student.id,
        studentName: student.displayName,
        contactNumber: privateRecord?.contactNumber,
        amountNote: privateRecord?.amountNote,
        paymentNote: privateRecord?.paymentNote,
        updatedAt: privateRecord?.updatedAt,
      }];
    });
  }

  const admin = createAdminSupabaseClient();
  const { data: subjects, error: subjectError } = await admin
    .from("subjects")
    .select("id")
    .eq("owner_teacher_id", identity.userId);
  if (subjectError) throw subjectError;
  const subjectIds = (subjects ?? []).map((row) => String(row.id));
  if (!subjectIds.length) return [];

  const { data: groups, error: groupError } = await admin
    .from("groups")
    .select("id,name")
    .in("subject_id", subjectIds)
    .eq("status", "active");
  if (groupError) throw groupError;
  const groupIds = (groups ?? []).map((row) => String(row.id));
  if (!groupIds.length) return [];
  const groupNames = new Map((groups ?? []).map((row) => [String(row.id), String(row.name)]));

  const { data: memberships, error: membershipError } = await admin
    .from("group_memberships")
    .select("group_id,student_id")
    .in("group_id", groupIds)
    .eq("status", "active");
  if (membershipError) throw membershipError;
  const studentIds = Array.from(new Set((memberships ?? []).map((row) => String(row.student_id))));
  if (!studentIds.length) return [];

  const [{ data: students, error: studentError }, { data: privateRows, error: privateError }] = await Promise.all([
    admin.from("profiles").select("id,display_name,role").in("id", studentIds).eq("role", "student"),
    admin.from("teacher_student_private_records")
      .select("teacher_id,student_id,group_id,contact_number,amount_note,payment_note,updated_at")
      .eq("teacher_id", identity.userId)
      .in("group_id", groupIds),
  ]);
  if (studentError || privateError) throw studentError ?? privateError;

  const studentNames = new Map((students ?? []).map((row) => [String(row.id), String(row.display_name)]));
  const privateMap = new Map((privateRows ?? []).map((row) => [`${row.group_id}:${row.student_id}`, row]));

  return (memberships ?? []).flatMap((membership) => {
    const groupId = String(membership.group_id);
    const studentId = String(membership.student_id);
    const studentName = studentNames.get(studentId);
    const groupName = groupNames.get(groupId);
    if (!studentName || !groupName) return [];
    const privateRecord = privateMap.get(`${groupId}:${studentId}`);
    return [{
      groupId,
      groupName,
      studentId,
      studentName,
      contactNumber: privateRecord?.contact_number ? String(privateRecord.contact_number) : undefined,
      amountNote: privateRecord?.amount_note ? String(privateRecord.amount_note) : undefined,
      paymentNote: privateRecord?.payment_note ? String(privateRecord.payment_note) : undefined,
      updatedAt: privateRecord?.updated_at ? String(privateRecord.updated_at) : undefined,
    }];
  });
}

export async function saveTeacherFinanceRecord(identity: Identity, rawInput: TeacherFinanceInput) {
  assertTeacher(identity);
  const input = normalizeTeacherFinanceInput(rawInput);
  assertAllowed(Boolean(input.groupId && input.studentId), "بيانات الطالب أو المجموعة غير مكتملة");

  if (isDemoBackend) {
    await mutateDemoDatabase((db) => {
      const group = assertFound(db.learningGroups.find((item) => item.id === input.groupId && item.status === "active"));
      const subject = assertFound(db.learningSubjects.find((item) => item.id === group.subjectId));
      assertAllowed(subject.teacherId === identity.userId);
      assertAllowed(db.learningMemberships.some((membership) =>
        membership.groupId === input.groupId && membership.studentId === input.studentId && membership.status === "active"));

      const existing = db.privateRecords.find((record) =>
        record.teacherId === identity.userId && record.groupId === input.groupId && record.studentId === input.studentId);
      if (existing) {
        existing.amountNote = input.amountNote;
        existing.paymentNote = input.paymentNote;
        existing.updatedAt = new Date().toISOString();
      } else {
        db.privateRecords.push({
          id: randomUUID(),
          teacherId: identity.userId,
          groupId: input.groupId,
          studentId: input.studentId,
          amountNote: input.amountNote,
          paymentNote: input.paymentNote,
          updatedAt: new Date().toISOString(),
        });
      }
    });
    return;
  }

  const admin = createAdminSupabaseClient();
  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("id,subject_id,status")
    .eq("id", input.groupId)
    .maybeSingle();
  if (groupError) throw groupError;
  const groupRow = assertFound(group as { id: string; subject_id: string | null; status: string } | null);
  assertAllowed(groupRow.status === "active" && Boolean(groupRow.subject_id), "المجموعة غير متاحة");

  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .select("id,owner_teacher_id")
    .eq("id", groupRow.subject_id!)
    .maybeSingle();
  if (subjectError) throw subjectError;
  assertAllowed(Boolean(subject) && String(subject!.owner_teacher_id) === identity.userId);

  const { count, error: membershipError } = await admin
    .from("group_memberships")
    .select("id", { count: "exact", head: true })
    .eq("group_id", input.groupId)
    .eq("student_id", input.studentId)
    .eq("status", "active");
  if (membershipError) throw membershipError;
  assertAllowed((count ?? 0) > 0, "الطالب غير مسجل في هذه المجموعة");

  const { error } = await admin.from("teacher_student_private_records").upsert({
    teacher_id: identity.userId,
    group_id: input.groupId,
    student_id: input.studentId,
    amount_note: input.amountNote ?? null,
    payment_note: input.paymentNote ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "teacher_id,student_id,group_id" });
  if (error) throw error;
}
