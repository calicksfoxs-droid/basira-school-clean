import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Live gate Supabase public environment is missing");
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  },
}));

import { SupabaseStore } from "@/lib/data/supabase-store";
import { loginWithAccessCode } from "@/lib/auth";
import type { Identity } from "@/domain/models";

const liveEnabled = process.env.RUN_PHASE17_LIVE_GATE === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminActorId = process.env.BASIRA_PHASE17_ADMIN_ID;

function requireLiveEnv() {
  if (!url || !anonKey || !serviceRoleKey || !adminActorId) {
    throw new Error("Phase 1.7 live gate environment is incomplete");
  }
  return {
    admin: createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    adminActorId,
  };
}

async function deleteTestAccount(admin: ReturnType<typeof createClient>, userId: string) {
  await admin.from("access_credentials").delete().eq("auth_user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  const result = await admin.auth.admin.deleteUser(userId);
  if (result.error && result.error.status !== 404) throw result.error;
}

describe.skipIf(!liveEnabled)("Phase 1.7 Production Auth Admin HTTP gate", () => {
  it("A/B: creates, gets, deletes, and proves exact Auth absence", async () => {
    const { admin } = requireLiveEnv();
    const userId = randomUUID();
    const requestMarker = randomUUID();
    const email = `basira.phase17.ab.${userId.replaceAll("-", "")}@access.invalid`;
    const password = `Aa1!${randomBytes(18).toString("base64url")}`;

    try {
      const created = await admin.auth.admin.createUser({
        id: userId,
        email,
        password,
        email_confirm: true,
        app_metadata: {
          basira_creation_request_id: requestMarker,
          basira_target_role: "teacher",
        },
      });
      expect(created.error).toBeNull();
      expect(created.data.user?.id).toBe(userId);

      const fetched = await admin.auth.admin.getUserById(userId);
      expect(fetched.error).toBeNull();
      expect(fetched.data.user?.id).toBe(userId);
      expect(fetched.data.user?.email).toBe(email);
      expect(fetched.data.user?.app_metadata?.basira_creation_request_id).toBe(requestMarker);
      expect(fetched.data.user?.app_metadata?.basira_target_role).toBe("teacher");
    } finally {
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error && deleted.error.status !== 404) throw deleted.error;
    }

    const absent = await admin.auth.admin.getUserById(userId);
    expect(absent.data.user ?? null).toBeNull();
    expect(absent.error).toBeTruthy();
  }, 30_000);

  it("C: creates one real Teacher through SupabaseStore and authenticates its returned access code", async () => {
    const { admin, adminActorId } = requireLiveEnv();
    const requestId = randomUUID();
    const identity: Identity = {
      userId: adminActorId,
      displayName: "Basira Admin",
      role: "admin",
      status: "active",
    };
    const store = new SupabaseStore();
    let createdUserId: string | undefined;

    try {
      const created = await store.createTeacher(identity, {
        creationRequestId: requestId,
        displayName: "Core 1.0 Phase 1.7 Live Gate",
      });
      createdUserId = created.user.id;
      console.log(`PHASE17_REQUEST_ID=${requestId}`);
      console.log(`PHASE17_USER_ID=${createdUserId}`);

      const authUser = await admin.auth.admin.getUserById(createdUserId);
      expect(authUser.error).toBeNull();
      expect(authUser.data.user?.id).toBe(createdUserId);
      expect(authUser.data.user?.app_metadata?.basira_creation_request_id).toBe(requestId);
      expect(authUser.data.user?.app_metadata?.basira_target_role).toBe("teacher");

      const profile = await admin.from("profiles")
        .select("id,role,status,created_by")
        .eq("id", createdUserId)
        .single();
      expect(profile.error).toBeNull();
      expect(profile.data).toMatchObject({
        id: createdUserId,
        role: "teacher",
        status: "active",
        created_by: adminActorId,
      });

      const credentials = await admin.from("access_credentials")
        .select("id,auth_user_id,public_account_ref,synthetic_email,role,state,first_used_at")
        .eq("auth_user_id", createdUserId)
        .neq("state", "disabled");
      expect(credentials.error).toBeNull();
      expect(credentials.data).toHaveLength(1);
      expect(credentials.data?.[0]).toMatchObject({
        auth_user_id: createdUserId,
        role: "teacher",
      });

      const operation = await admin.rpc("get_account_creation_operation_v1", {
        p_request_id: requestId,
        p_actor_id: adminActorId,
      }).single();
      expect(operation.error).toBeNull();
      expect(operation.data).toMatchObject({
        request_id: requestId,
        auth_user_id: createdUserId,
        target_role: "teacher",
        state: "complete",
      });

      const login = await loginWithAccessCode(created.code);
      expect(login).toMatchObject({
        ok: true,
        identity: {
          userId: createdUserId,
          role: "teacher",
          status: "active",
        },
      });

      const activatedCredential = await admin.from("access_credentials")
        .select("state,first_used_at")
        .eq("auth_user_id", createdUserId)
        .neq("state", "disabled")
        .single();
      expect(activatedCredential.error).toBeNull();
      expect(activatedCredential.data?.state).toBe("active");
      expect(activatedCredential.data?.first_used_at).toBeTruthy();
    } finally {
      if (createdUserId) await deleteTestAccount(admin, createdUserId);
    }

    if (!createdUserId) throw new Error("Store-level live gate did not create a user");

    const [authAbsent, profileAbsent, credentialAbsent] = await Promise.all([
      admin.auth.admin.getUserById(createdUserId),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("id", createdUserId),
      admin.from("access_credentials").select("id", { count: "exact", head: true }).eq("auth_user_id", createdUserId),
    ]);
    expect(authAbsent.data.user ?? null).toBeNull();
    expect(authAbsent.error).toBeTruthy();
    expect(profileAbsent.count ?? 0).toBe(0);
    expect(credentialAbsent.count ?? 0).toBe(0);
  }, 45_000);
});
