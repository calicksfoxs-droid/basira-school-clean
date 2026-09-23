import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Identity } from "@/domain/models";
import { SupabaseStore } from "@/lib/data/supabase-store";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const adminIdentity: Identity = {
  userId: "68866895-1e1c-4d24-913f-3e1a18c64ff7",
  displayName: "Phase17 Admin",
  role: "admin",
  status: "active",
};

const teacherA: Identity = {
  userId: "ad9112b7-5aaf-4bb1-b630-f02716d8462e",
  displayName: "Phase17 Teacher A",
  role: "teacher",
  status: "active",
};

const teacherB = "c0822ee9-62e7-488d-863b-e99023b6df6f";
const ownedGroup = "9177f5e9-75b3-4f5c-92aa-662899142357";

const foreignGroup = "c7100000-0000-4000-8000-000000000001";
const inactiveGroup = "c7100000-0000-4000-8000-000000000002";
const driftGroup = "c7100000-0000-4000-8000-000000000003";

const reqTeacher = "a7100000-0000-4000-8000-000000000001";
const reqTeacherDenied = "a7100000-0000-4000-8000-000000000002";
const reqAdminStudent = "a7100000-0000-4000-8000-000000000003";
const reqTeacherStudent = "a7100000-0000-4000-8000-000000000004";
const reqForeignStudent = "a7100000-0000-4000-8000-000000000005";
const reqInactiveStudent = "a7100000-0000-4000-8000-000000000006";
const reqDriftStudent = "a7100000-0000-4000-8000-000000000007";

const requests = [
  [reqTeacher, adminIdentity.userId],
  [reqTeacherDenied, teacherA.userId],
  [reqAdminStudent, adminIdentity.userId],
  [reqTeacherStudent, teacherA.userId],
  [reqForeignStudent, teacherA.userId],
  [reqInactiveStudent, adminIdentity.userId],
  [reqDriftStudent, teacherA.userId],
] as const;

const admin = createAdminSupabaseClient();
const store = new SupabaseStore() as SupabaseStore & { client: () => Promise<typeof admin> };

function failMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function operation(requestId: string, actorId: string) {
  const { data, error } = await admin
    .rpc("get_account_creation_operation_v1", {
      p_request_id: requestId,
      p_actor_id: actorId,
    })
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

async function cleanupRequest(requestId: string, actorId: string) {
  const op = await operation(requestId, actorId).catch(() => null);
  const authUserId = op?.auth_user_id ? String(op.auth_user_id) : null;
  if (!authUserId) return;

  await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
  await admin.from("teacher_student_private_records").delete().eq("student_id", authUserId);
  await admin.from("group_memberships").delete().eq("student_id", authUserId);
  await admin.from("access_credentials").delete().eq("auth_user_id", authUserId);
  await admin.from("profiles").delete().eq("id", authUserId);
}

beforeAll(async () => {
  // resetAccessCode/listUsers normally uses a request-bound server client. For this
  // production smoke only, bind it to the same service-role client.
  store.client = async () => admin;

  // Cleanup any stale public/Auth fixtures from a prior interrupted smoke.
  for (const [requestId, actorId] of requests) {
    await cleanupRequest(requestId, actorId);
  }
  await admin.from("groups").delete().in("id", [foreignGroup, inactiveGroup, driftGroup]);

  const { error } = await admin.from("groups").insert([
    {
      id: foreignGroup,
      name: "__phase17_live_foreign__",
      owner_teacher_id: teacherB,
      status: "active",
      created_by: adminIdentity.userId,
    },
    {
      id: inactiveGroup,
      name: "__phase17_live_inactive__",
      owner_teacher_id: teacherA.userId,
      status: "archived",
      created_by: adminIdentity.userId,
    },
    {
      id: driftGroup,
      name: "__phase17_live_drift__",
      owner_teacher_id: teacherA.userId,
      status: "active",
      created_by: adminIdentity.userId,
    },
  ]);
  if (error) throw error;
});

afterAll(async () => {
  for (const [requestId, actorId] of requests) {
    await cleanupRequest(requestId, actorId);
  }
  await admin.from("groups").delete().in("id", [foreignGroup, inactiveGroup, driftGroup]);
});

describe.sequential("Phase 1.7 production live smoke", () => {
  it("A1 Admin creates Teacher with one profile and current credential", async () => {
    const created = await store.createTeacher(adminIdentity, {
      creationRequestId: reqTeacher,
      displayName: "__phase17_live_teacher__",
    });

    expect(created.user.role).toBe("teacher");

    const [{ count: profileCount }, { count: credentialCount }, authResult] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("id", created.user.id),
      admin.from("access_credentials")
        .select("id", { count: "exact", head: true })
        .eq("auth_user_id", created.user.id)
        .neq("state", "disabled"),
      admin.auth.admin.getUserById(created.user.id),
    ]);

    expect(authResult.error).toBeNull();
    expect(authResult.data.user?.id).toBe(created.user.id);
    expect(profileCount).toBe(1);
    expect(credentialCount).toBe(1);
  });

  it("A1 non-Admin Teacher creation is rejected with no operation/Auth side effect", async () => {
    await expect(store.createTeacher(teacherA, {
      creationRequestId: reqTeacherDenied,
      displayName: "__phase17_denied_teacher__",
    })).rejects.toBeTruthy();

    expect(await operation(reqTeacherDenied, teacherA.userId)).toBeNull();
  });

  it("A2 Admin creates Student into active Group with exactly one membership", async () => {
    const created = await store.createStudent(adminIdentity, {
      creationRequestId: reqAdminStudent,
      displayName: "__phase17_admin_student__",
      groupId: ownedGroup,
    });

    const [{ count: profileCount }, { count: membershipCount }, { count: credentialCount }] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("id", created.user.id),
      admin.from("group_memberships")
        .select("id", { count: "exact", head: true })
        .eq("student_id", created.user.id)
        .eq("group_id", ownedGroup)
        .eq("status", "active"),
      admin.from("access_credentials")
        .select("id", { count: "exact", head: true })
        .eq("auth_user_id", created.user.id)
        .neq("state", "disabled"),
    ]);

    expect(profileCount).toBe(1);
    expect(membershipCount).toBe(1);
    expect(credentialCount).toBe(1);
  });

  it("A2 Teacher creates Student in own Group with required private record", async () => {
    const created = await store.createStudent(teacherA, {
      creationRequestId: reqTeacherStudent,
      displayName: "__phase17_teacher_student__",
      groupId: ownedGroup,
      contactNumber: "55517001",
    });

    const [{ count: membershipCount }, { count: privateCount }, { count: credentialCount }] = await Promise.all([
      admin.from("group_memberships")
        .select("id", { count: "exact", head: true })
        .eq("student_id", created.user.id)
        .eq("group_id", ownedGroup)
        .eq("status", "active"),
      admin.from("teacher_student_private_records")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherA.userId)
        .eq("student_id", created.user.id)
        .eq("group_id", ownedGroup),
      admin.from("access_credentials")
        .select("id", { count: "exact", head: true })
        .eq("auth_user_id", created.user.id)
        .neq("state", "disabled"),
    ]);

    expect(membershipCount).toBe(1);
    expect(privateCount).toBe(1);
    expect(credentialCount).toBe(1);
  });

  it("A2 Teacher foreign Group is rejected before account creation", async () => {
    await expect(store.createStudent(teacherA, {
      creationRequestId: reqForeignStudent,
      displayName: "__phase17_foreign_student__",
      groupId: foreignGroup,
    })).rejects.toBeTruthy();

    expect(await operation(reqForeignStudent, teacherA.userId)).toBeNull();
  });

  it("A2 inactive Group is rejected before account creation", async () => {
    await expect(store.createStudent(adminIdentity, {
      creationRequestId: reqInactiveStudent,
      displayName: "__phase17_inactive_student__",
      groupId: inactiveGroup,
    })).rejects.toBeTruthy();

    expect(await operation(reqInactiveStudent, adminIdentity.userId)).toBeNull();
  });

  it("Failure A: prepared Auth residue is cleaned before authority rejection", async () => {
    const { data: prepared, error: prepareError } = await admin
      .rpc("prepare_account_creation_v1", {
        p_request_id: reqDriftStudent,
        p_actor_id: teacherA.userId,
        p_target_role: "student",
        p_group_id: driftGroup,
        p_display_name: "__phase17_drift_student__",
        p_public_account_ref: "Z7D1",
        p_contact_number: "55517002",
      })
      .single();
    if (prepareError) throw prepareError;

    const row = prepared as Record<string, unknown>;
    const authUserId = String(row.auth_user_id);
    const syntheticEmail = String(row.synthetic_email);

    const authCreate = await admin.auth.admin.createUser({
      id: authUserId,
      email: syntheticEmail,
      password: "Phase17-Smoke-Password-903!",
      email_confirm: true,
      user_metadata: { display_name: "__phase17_drift_student__" },
      app_metadata: {
        basira_creation_request_id: reqDriftStudent,
        basira_target_role: "student",
      },
    });
    if (authCreate.error) throw authCreate.error;

    const archive = await admin.from("groups").update({ status: "archived" }).eq("id", driftGroup);
    if (archive.error) throw archive.error;

    await expect(store.createStudent(teacherA, {
      creationRequestId: reqDriftStudent,
      displayName: "__phase17_drift_student__",
      groupId: driftGroup,
      contactNumber: "55517002",
    })).rejects.toBeTruthy();

    const observed = await operation(reqDriftStudent, teacherA.userId);
    expect(observed?.state).toBe("cleaned");

    const authAfter = await admin.auth.admin.getUserById(authUserId);
    expect(authAfter.error).toBeTruthy();

    const { count: profileCount } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("id", authUserId);
    expect(profileCount).toBe(0);
  });

  it("Failure D: request-intent mismatch changes no account state", async () => {
    const before = await operation(reqTeacher, adminIdentity.userId);
    const authUserId = String(before?.auth_user_id);

    const { count: beforeCredentials } = await admin
      .from("access_credentials")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", authUserId)
      .neq("state", "disabled");

    await expect(store.createTeacher(adminIdentity, {
      creationRequestId: reqTeacher,
      displayName: "__phase17_DIFFERENT_teacher__",
    })).rejects.toMatchObject({ code: "ACCOUNT_CREATION_REQUEST_MISMATCH" });

    const { count: afterCredentials } = await admin
      .from("access_credentials")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", authUserId)
      .neq("state", "disabled");

    expect(afterCredentials).toBe(beforeCredentials);
  });

  it("Failure G: complete retry reuses the same Auth user and leaves one current credential", async () => {
    const before = await operation(reqTeacher, adminIdentity.userId);
    const authUserId = String(before?.auth_user_id);

    const retried = await store.createTeacher(adminIdentity, {
      creationRequestId: reqTeacher,
      displayName: "__phase17_live_teacher__",
    });

    expect(retried.user.id).toBe(authUserId);

    const [{ count: profileCount }, { count: currentCredentialCount }, authResult] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("id", authUserId),
      admin.from("access_credentials")
        .select("id", { count: "exact", head: true })
        .eq("auth_user_id", authUserId)
        .neq("state", "disabled"),
      admin.auth.admin.getUserById(authUserId),
    ]);

    expect(profileCount).toBe(1);
    expect(currentCredentialCount).toBe(1);
    expect(authResult.error).toBeNull();
    expect(authResult.data.user?.id).toBe(authUserId);
  });
});
