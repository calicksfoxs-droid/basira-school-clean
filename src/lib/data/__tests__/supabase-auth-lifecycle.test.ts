import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/demo/demo-db", () => ({
  generateAccessCode: vi.fn(() => ({
    publicRef: "ZX90",
    secret: "AB12CD34",
    code: "BSR-ZX90-AB12CD34",
  })),
}));

import { SupabaseStore } from "@/lib/data/supabase-store";
import type { Identity, UserRecord } from "@/domain/models";

type QueryResponse = { data?: unknown; error?: { message: string } | null };
type Call = { table: string; method: string; payload?: unknown };

function makeBuilder(table: string, response: QueryResponse, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "update", "insert", "delete", "eq", "neq", "in", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ table, method, payload: args.length === 1 ? args[0] : args });
      return builder;
    };
  }
  builder.single = async () => response;
  builder.maybeSingle = async () => response;
  builder.then = (
    onFulfilled: (value: QueryResponse) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(onFulfilled, onRejected);
  return builder;
}

function makeAdmin(input: {
  profiles: QueryResponse[];
  credentials: QueryResponse[];
  authUpdateError?: { message: string } | null;
  authUpdateThrow?: Error;
}) {
  const calls: Call[] = [];
  const queues: Record<string, QueryResponse[]> = {
    profiles: [...input.profiles],
    access_credentials: [...input.credentials],
  };

  const updateUserById = vi.fn(async () => {
    if (input.authUpdateThrow) throw input.authUpdateThrow;
    return { data: { user: { id: "student-1" } }, error: input.authUpdateError ?? null };
  });

  const admin = {
    from: vi.fn((table: string) => {
      const response = queues[table]?.shift();
      if (!response) throw new Error(`Unexpected query for ${table}`);
      return makeBuilder(table, response, calls);
    }),
    auth: { admin: { updateUserById } },
  };

  return { admin, calls, updateUserById };
}

const adminIdentity: Identity = {
  userId: "admin-1",
  displayName: "Admin",
  role: "admin",
  status: "active",
};

const targetUser: UserRecord = {
  id: "student-1",
  displayName: "Student",
  role: "student",
  status: "active",
  syntheticEmail: "old@example.invalid",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function installAdmin(store: SupabaseStore, admin: unknown) {
  vi.spyOn(store, "listUsers").mockResolvedValue([targetUser]);
  const storeWithAdmin = store as unknown as { admin: () => typeof admin };
  vi.spyOn(storeWithAdmin, "admin").mockReturnValue(admin);
}

function profileUpdates(calls: Call[]) {
  return calls.filter((call) => call.table === "profiles" && call.method === "update");
}

function credentialUpdates(calls: Call[]) {
  return calls.filter((call) => call.table === "access_credentials" && call.method === "update");
}

describe("Supabase auth lifecycle compensation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("may restore the previous state on a pre-Auth DB failure", async () => {
    const { admin, calls, updateUserById } = makeAdmin({
      profiles: [
        { data: { status: "active", session_invalid_before: "2026-01-01T00:00:00.000Z" }, error: null },
        { data: { id: "student-1" }, error: null },
        { data: { id: "student-1" }, error: null },
      ],
      credentials: [
        { data: [{ id: "old-cred", state: "active", disabled_at: null }], error: null },
        { error: null },
        { error: { message: "insert failed" } },
        { data: { id: "old-cred" }, error: null },
      ],
    });

    const store = new SupabaseStore();
    installAdmin(store, admin);

    await expect(store.resetAccessCode(adminIdentity, targetUser.id))
      .rejects.toMatchObject({ message: "insert failed" });

    expect(updateUserById).not.toHaveBeenCalled();

    const pUpdates = profileUpdates(calls);
    expect(pUpdates).toHaveLength(2);
    expect(pUpdates[0].payload).toMatchObject({ status: "disabled" });
    expect(pUpdates[1].payload).toEqual({
      status: "active",
      session_invalid_before: "2026-01-01T00:00:00.000Z",
    });

    expect(credentialUpdates(calls)).toContainEqual({
      table: "access_credentials",
      method: "update",
      payload: { state: "active", disabled_at: null },
    });
  });

  it("does not restore old session or credential state after an attempted Auth call returns an error", async () => {
    const { admin, calls, updateUserById } = makeAdmin({
      profiles: [
        { data: { status: "active", session_invalid_before: "2026-01-01T00:00:00.000Z" }, error: null },
        { data: { id: "student-1" }, error: null },
      ],
      credentials: [
        { data: [{ id: "old-cred", state: "active", disabled_at: null }], error: null },
        { error: null },
        { data: { id: "new-cred" }, error: null },
      ],
      authUpdateError: { message: "ambiguous auth failure" },
    });

    const store = new SupabaseStore();
    installAdmin(store, admin);

    await expect(store.resetAccessCode(adminIdentity, targetUser.id))
      .rejects.toMatchObject({ message: "ambiguous auth failure" });

    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(profileUpdates(calls)).toHaveLength(1);
    expect(profileUpdates(calls)[0].payload).toMatchObject({ status: "disabled" });

    const updates = credentialUpdates(calls);
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({ state: "disabled" });
    expect(updates).not.toContainEqual(expect.objectContaining({
      payload: { state: "active", disabled_at: null },
    }));
  });

  it("stays fail-secure when the attempted Auth call throws a transport-style error", async () => {
    const { admin, calls, updateUserById } = makeAdmin({
      profiles: [
        { data: { status: "active", session_invalid_before: "2026-01-01T00:00:00.000Z" }, error: null },
        { data: { id: "student-1" }, error: null },
      ],
      credentials: [
        { data: [{ id: "old-cred", state: "active", disabled_at: null }], error: null },
        { error: null },
        { data: { id: "new-cred" }, error: null },
      ],
      authUpdateThrow: new Error("transport lost"),
    });

    const store = new SupabaseStore();
    installAdmin(store, admin);

    await expect(store.resetAccessCode(adminIdentity, targetUser.id))
      .rejects.toThrow("transport lost");

    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(profileUpdates(calls)).toHaveLength(1);
    expect(profileUpdates(calls)[0].payload).toMatchObject({ status: "disabled" });
    expect(credentialUpdates(calls)).toHaveLength(1);
    expect(credentialUpdates(calls)[0].payload).toMatchObject({ state: "disabled" });
  });

  it("writes a fresh final watermark after successful Auth mutation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T21:30:00.500Z"));

    const { admin, calls, updateUserById } = makeAdmin({
      profiles: [
        { data: { status: "active", session_invalid_before: "2026-01-01T00:00:00.000Z" }, error: null },
        { data: { id: "student-1" }, error: null },
        { data: { id: "student-1" }, error: null },
      ],
      credentials: [
        { data: [{ id: "old-cred", state: "active", disabled_at: null }], error: null },
        { error: null },
        { data: { id: "new-cred" }, error: null },
      ],
    });

    const store = new SupabaseStore();
    installAdmin(store, admin);

    const result = await store.resetAccessCode(adminIdentity, targetUser.id);

    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(result.code).toBe("BSR-ZX90-AB12CD34");

    const pUpdates = profileUpdates(calls);
    expect(pUpdates).toHaveLength(2);

    const initial = pUpdates[0].payload as Record<string, unknown>;
    const final = pUpdates[1].payload as Record<string, unknown>;
    expect(initial.status).toBe("disabled");
    expect(final.status).toBe("active");
    expect(new Date(String(final.session_invalid_before)).getTime())
      .toBeGreaterThan(new Date(String(initial.session_invalid_before)).getTime());
    expect(result.user.sessionInvalidBefore).toBe(final.session_invalid_before);
  });

  it("does not roll back security state when the final watermark write fails", async () => {
    const { admin, calls, updateUserById } = makeAdmin({
      profiles: [
        { data: { status: "active", session_invalid_before: "2026-01-01T00:00:00.000Z" }, error: null },
        { data: { id: "student-1" }, error: null },
        { error: { message: "final watermark failed" } },
      ],
      credentials: [
        { data: [{ id: "old-cred", state: "active", disabled_at: null }], error: null },
        { error: null },
        { data: { id: "new-cred" }, error: null },
      ],
    });

    const store = new SupabaseStore();
    installAdmin(store, admin);

    await expect(store.resetAccessCode(adminIdentity, targetUser.id))
      .rejects.toMatchObject({ message: "final watermark failed" });

    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(profileUpdates(calls)).toHaveLength(2);

    const updates = credentialUpdates(calls);
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({ state: "disabled" });
    expect(updates).not.toContainEqual(expect.objectContaining({
      payload: { state: "active", disabled_at: null },
    }));
  });

  it("does not overwrite a concurrent disable or newer profile state at finalization", async () => {
    const { admin, calls } = makeAdmin({
      profiles: [
        { data: { status: "active", session_invalid_before: "2026-01-01T00:00:00.000Z" }, error: null },
        { data: { id: "student-1" }, error: null },
        { data: null, error: null },
      ],
      credentials: [
        { data: [{ id: "old-cred", state: "active", disabled_at: null }], error: null },
        { error: null },
        { data: { id: "new-cred" }, error: null },
      ],
    });

    const store = new SupabaseStore();
    installAdmin(store, admin);

    await expect(store.resetAccessCode(adminIdentity, targetUser.id))
      .rejects.toThrow("Access reset state changed before finalization");

    expect(profileUpdates(calls)).toHaveLength(2);
    expect(credentialUpdates(calls)).toHaveLength(1);
    expect(credentialUpdates(calls)[0].payload).toMatchObject({ state: "disabled" });
  });

  it("places the effective final boundary after every token minted in the reset window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T21:30:00.500Z"));

    const { admin, calls } = makeAdmin({
      profiles: [
        { data: { status: "active", session_invalid_before: "2026-01-01T00:00:00.000Z" }, error: null },
        { data: { id: "student-1" }, error: null },
        { data: { id: "student-1" }, error: null },
      ],
      credentials: [
        { data: [{ id: "old-cred", state: "active", disabled_at: null }], error: null },
        { error: null },
        { data: { id: "new-cred" }, error: null },
      ],
    });

    const store = new SupabaseStore();
    installAdmin(store, admin);
    await store.resetAccessCode(adminIdentity, targetUser.id);

    const pUpdates = profileUpdates(calls);
    const resetStartedAt = new Date(String(
      (pUpdates[0].payload as Record<string, unknown>).session_invalid_before,
    )).getTime();
    const finalInvalidBefore = new Date(String(
      (pUpdates[1].payload as Record<string, unknown>).session_invalid_before,
    )).getTime();

    // JWT iat has second precision. session_is_current() subtracts one second
    // from the watermark, so model the newest possible token minted pre-finalize.
    const newestWindowTokenIatMs = Math.floor(resetStartedAt / 1000) * 1000;
    const effectiveFinalBoundary = finalInvalidBefore - 1000;

    expect(newestWindowTokenIatMs).toBeLessThan(effectiveFinalBoundary);
  });

  it("surfaces credential bookkeeping failure without re-enabling a disabled profile", async () => {
    const { admin, calls } = makeAdmin({
      profiles: [{ error: null }],
      credentials: [{ error: { message: "credential update failed" } }],
    });

    const store = new SupabaseStore();
    installAdmin(store, admin);

    await expect(store.disableUser(adminIdentity, targetUser.id))
      .rejects.toMatchObject({ message: "credential update failed" });

    const pUpdates = profileUpdates(calls);
    expect(pUpdates).toHaveLength(1);
    expect(pUpdates[0].payload).toMatchObject({ status: "disabled" });
  });
});
