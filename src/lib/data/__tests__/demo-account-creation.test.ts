import { beforeEach, describe, expect, it } from "vitest";

import type { Identity } from "@/domain/models";
import { DemoStore } from "@/lib/data/demo-store";
import { readDemoDatabase, resetDemoDatabase } from "@/lib/demo/demo-db";

const admin: Identity = {
  userId: "00000000-0000-4000-8000-000000000001",
  displayName: "مدير بصيرة",
  role: "admin",
  status: "active",
};

const teacher: Identity = {
  userId: "00000000-0000-4000-8000-000000000002",
  displayName: "أ. أحمد",
  role: "teacher",
  status: "active",
};

const seededGroupId = "10000000-0000-4000-8000-000000000001";

describe.sequential("Demo account creation atomicity parity", () => {
  beforeEach(async () => {
    await resetDemoDatabase();
  });

  it("creates an Admin-owned Teacher account as one logical operation", async () => {
    const store = new DemoStore();
    const requestId = "93000000-0000-4000-8000-000000000001";

    const result = await store.createTeacher(admin, {
      creationRequestId: requestId,
      displayName: "أ. جديد",
    });

    const db = await readDemoDatabase();
    expect(result.user).toMatchObject({ id: requestId, role: "teacher", status: "active" });
    expect(db.users.filter((user) => user.id === requestId)).toHaveLength(1);
    expect(db.credentials.filter((credential) =>
      credential.userId === requestId && credential.state !== "disabled"
    )).toHaveLength(1);
  });

  it("requires a Group for Admin Student creation and leaves no partial user on rejection", async () => {
    const store = new DemoStore();
    const requestId = "93000000-0000-4000-8000-000000000002";

    await expect(store.createStudent(admin, {
      creationRequestId: requestId,
      displayName: "طالب بلا مجموعة",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const db = await readDemoDatabase();
    expect(db.users.some((user) => user.id === requestId)).toBe(false);
    expect(db.credentials.some((credential) => credential.userId === requestId)).toBe(false);
  });

  it("rejects a Teacher foreign-Group Student request before creating any account state", async () => {
    const store = new DemoStore();
    const secondTeacherRequest = "93000000-0000-4000-8000-000000000003";
    const secondTeacher = await store.createTeacher(admin, {
      creationRequestId: secondTeacherRequest,
      displayName: "أ. ثاني",
    });
    const foreignGroup = await store.createGroup(admin, {
      name: "مجموعة المعلم الثاني",
      ownerTeacherId: secondTeacher.user.id,
    });
    const studentRequest = "93000000-0000-4000-8000-000000000004";

    await expect(store.createStudent(teacher, {
      creationRequestId: studentRequest,
      displayName: "طالب غير مسموح",
      groupId: foreignGroup.id,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const db = await readDemoDatabase();
    expect(db.users.some((user) => user.id === studentRequest)).toBe(false);
    expect(db.memberships.some((membership) => membership.studentId === studentRequest)).toBe(false);
    expect(db.privateRecords.some((record) => record.studentId === studentRequest)).toBe(false);
  });

  it("creates Teacher Student membership and private record in the same Demo mutation", async () => {
    const store = new DemoStore();
    const requestId = "93000000-0000-4000-8000-000000000005";

    const result = await store.createStudent(teacher, {
      creationRequestId: requestId,
      displayName: "طالب كامل",
      groupId: seededGroupId,
      contactNumber: "55512345",
    });

    const db = await readDemoDatabase();
    expect(result.user.id).toBe(requestId);
    expect(db.memberships).toContainEqual(expect.objectContaining({
      groupId: seededGroupId,
      studentId: requestId,
      status: "active",
    }));
    expect(db.privateRecords).toContainEqual(expect.objectContaining({
      teacherId: teacher.userId,
      studentId: requestId,
      groupId: seededGroupId,
      contactNumber: "55512345",
    }));
  });

  it("retries the same creation request without duplicating user or membership", async () => {
    const store = new DemoStore();
    const requestId = "93000000-0000-4000-8000-000000000006";
    const input = {
      creationRequestId: requestId,
      displayName: "طالب ثابت",
      groupId: seededGroupId,
      contactNumber: "55567890",
    };

    const first = await store.createStudent(teacher, input);
    const second = await store.createStudent(teacher, input);
    const db = await readDemoDatabase();

    expect(second.user.id).toBe(first.user.id);
    expect(second.code).not.toBe(first.code);
    expect(db.users.filter((user) => user.id === requestId)).toHaveLength(1);
    expect(db.memberships.filter((membership) =>
      membership.studentId === requestId && membership.groupId === seededGroupId
    )).toHaveLength(1);
    expect(db.privateRecords.filter((record) =>
      record.studentId === requestId &&
      record.groupId === seededGroupId &&
      record.teacherId === teacher.userId
    )).toHaveLength(1);
    expect(db.credentials.filter((credential) =>
      credential.userId === requestId && credential.state !== "disabled"
    )).toHaveLength(1);
  });
});
