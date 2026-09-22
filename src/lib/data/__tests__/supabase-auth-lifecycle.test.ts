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

type QueryError = { message: string };
type QueryResponse = { data?: unknown; error?: QueryError | null };
type Call = { table: string; method: string; payload?: unknown };

const previousProfile = {
  status: "active",
  session_invalid_before: "2026-01-01T00:00:00.000Z",
};

const previousCredentials = [{
  id: "old-cred",
  state: "active",
  disabled_at: null,
}];

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
  authUpdateError?: QueryError | null;
  authUpdateThrow?: Error;
}) {
  const calls: Call[] = [];
  const queues: Record<string, QueryResponse[]> = {
    profiles: [...input.profiles],
    access_credentials: [...input.credentials],
  };

  const updateUserById = vi.fn(async () => {
    if (input.authUpdateThrow) throw input.authUpdateThrow;
    return { data: { user: { id: targetUser.id } }, error: input.authUpdateError ?? null };
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

function makeResetAdmin(input: {
  insertError?: QueryError;
  authUpdateError?: QueryError;
  authUpdateThrow?: Error;
  finalProfile?: QueryResponse;
} = {}) {
  const profiles: QueryResponse[] = [
    { data: previousProfile, error: null },
    { data: { id: targetUser.id }, error: null },
  ];
  const credentials: QueryResponse[] = [
    { data: previousCredentials, error: null },
    { error: null },
  ];

  if (input.insertError) {
    credentials.push(
      { error: input.insertError },
      { data: { id: "old-cred" }, error: null },
    );
    profiles.push({ data: { id: targetUser.id }, error: null });
  } else {
    credentials.push({ data: { id: "new-cred" }, error: null });
    if (!input.authUpdateError && !input.authUpdateThrow) {
      profiles.push(input.finalProfile ?? { data: { id: targetUser.id }, error: null });
    }
  }

  return makeAdmin({
    profiles,
    credentials,
    authUpdateError: input.authUpdateError,
    authUpdateThrow: input.authUpdateThrow,
  });
}

function installAdmin(store: SupabaseStore, admin: unknown) {
  vi.spyOn(store, "listUsers").mockResolvedValue([targetUser]);
  const storeWithAdmin = store as unknown as { admin: () => typeof admin };
  vi.spyOn(storeWithAdmin, "admin").mockReturnValue(admin);
}

function tableUpdates(calls: Call[], table: string) {
  return calls.filter((call) => call.table === table && call.method === "update");
}

function expectFailSecureResetState(calls: Call[]) {
  const profileUpdates = tableUpdates(calls, "profiles");
  const credentialUpdates = tableUpdates(calls, "access_credentials");

  expect(profileUpdates).toHaveLength(1);
  expect(profileUpdates[0].payload).toMatchObject({ status: "disabled" });
  expect(credentialUpdates).toHaveLength(1);
  expect(credentialUpdates[0].payload).toMatchObject({ state: "disabled" });
}

describe("Supabase auth lifecycle compensation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("restores previous state only when failure happens before Auth is attempted", async () => {
    const { admin, calls, updateUserById } = makeResetAdmin({
      insertError: { message: "insert failed" },
    });
    const store = new SupabaseStore();
    installAdmin(store, admin);

    await expect(store.resetAccessCode(adminIdentity, targetUser.id))
      .rejects.toMatchObject({ message: "insert failed" });

    expect(updateUserById).not.toHaveBeenCalled();

    const profileUpdates = tableUpdates(calls, "profiles");
    expect(profileUpdates).toHaveLength(2);
    expect(profileUpdates[0].payload).toMatchObject({ status: "disabled" });
    expect(profileUpdates[1].payload).toEqual({
      status: "active",
      session_invalid_before: previousProfile.session_invalid_before,
    });

    expect(tableUpdates(calls, "access_credentials")).toContainEqual({
      table: "access_credentials",
      method: "update",
      payload: { state: "active", disabled_at: null },
    });
  });

  it.each([
    {
      label: "returned Auth error",
      authUpdateError: { message: "ambiguous auth failure" },
      expected: "ambiguous auth failure",
    },
    {
      label: "transport-style Auth throw",
      authUpdateThrow: new Error("transport lost"),
      expected: "transport lost",
    },
  ])("keeps reset fail-secure after an attempted $label", async (scenario) => {
    const { admin, calls, updateUserById } = makeResetAdmin(scenario);
    const store = new SupabaseStore();
    installAdmin(store, admin);

    let thrown: unknown;
    try {
      await store.resetAccessCode(adminIdentity, targetUser.id);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ message: scenario.expected });
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expectFailSecureResetState(calls);
  });

  it("writes a fresh final watermark only after successful Auth mutation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T21:30:00.500Z"));

    const { admin, calls, updateUserById } = makeResetAdmin();
    const store = new SupabaseStore();
    installAdmin(store, admin);

    const result = await store.resetAccessCode(adminIdentity, targetUser.id);
    const profileUpdates = tableUpdates(calls, "profiles");
    const initial = profileUpdates[0].payload as Record<string, unknown>;
    const final = profileUpdates[1].payload as Record<string, unknown>;

    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(result.code).toBe("BSR-ZX90-AB12CD34");
    expect(initial.status).toBe("disabled");
    expect(final.status).toBe("active");
    expect(new Date(String(final.session_invalid_before)).getTime())
      .toBeGreaterThan(new Date(String(initial.session_invalid_before)).getTime());
    expect(result.user.sessionInvalidBefore).toBe(final.session_invalid_before);
  });

  it.each([
    {
      label: "final watermark write fails",
      finalProfile: { error: { message: "final watermark failed" } },
      expected: "final watermark failed",
    },
    {
      label: "reset lock is superseded by newer profile state",
      finalProfile: { data: null, error: null },
      expected: "Access reset state changed before finalization",
    },
  ])("does not roll security state backward when $label", async (scenario) => {
    const { admin, calls } = makeResetAdmin({ finalProfile: scenario.finalProfile });
    const store = new SupabaseStore();
    installAdmin(store, admin);

    let thrown: unknown;
    try {
      await store.resetAccessCode(adminIdentity, targetUser.id);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ message: scenario.expected });

    const profileUpdates = tableUpdates(calls, "profiles");
    expect(profileUpdates).toHaveLength(2);

    const credentialUpdates = tableUpdates(calls, "access_credentials");
    expect(credentialUpdates).toHaveLength(1);
    expect(credentialUpdates[0].payload).toMatchObject({ state: "disabled" });
  });

  it("places the effective final boundary after reset-window JWTs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T21:30:00.500Z"));

    const { admin, calls } = makeResetAdmin();
    const store = new SupabaseStore();
    installAdmin(store, admin);
    await store.resetAccessCode(adminIdentity, targetUser.id);

    const profileUpdates = tableUpdates(calls, "profiles");
    const resetStartedAt = new Date(String(
      (profileUpdates[0].payload as Record<string, unknown>).session_invalid_before,
    )).getTime();
    const finalInvalidBefore = new Date(String(
      (profileUpdates[1].payload as Record<string, unknown>).session_invalid_before,
    )).getTime();

    // JWT iat has second precision; session_is_current() allows one second of skew.
    const newestWindowTokenIatMs = Math.floor(resetStartedAt / 1000) * 1000;
    const effectiveFinalBoundary = finalInvalidBefore - 1000;

    expect(newestWindowTokenIatMs).toBeLessThan(effectiveFinalBoundary);
  });

  it("surfaces disable bookkeeping failure without re-enabling the profile", async () => {
    const { admin, calls } = makeAdmin({
      profiles: [{ error: null }],
      credentials: [{ error: { message: "credential update failed" } }],
    });
    const store = new SupabaseStore();
    installAdmin(store, admin);

    await expect(store.disableUser(adminIdentity, targetUser.id))
      .rejects.toMatchObject({ message: "credential update failed" });

    expect(tableUpdates(calls, "profiles")).toHaveLength(1);
    expect(tableUpdates(calls, "profiles")[0].payload).toMatchObject({ status: "disabled" });
  });
});
