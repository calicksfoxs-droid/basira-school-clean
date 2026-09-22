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
}) {
  const calls: Call[] = [];
  const queues: Record<string, QueryResponse[]> = {
    profiles: [...input.profiles],
    access_credentials: [...input.credentials],
  };

  const admin = {
    from: vi.fn((table: string) => {
      const response = queues[table]?.shift();
      if (!response) throw new Error(`Unexpected query for ${table}`);
      return makeBuilder(table, response, calls);
    }),
    auth: {
      admin: {
        updateUserById: vi.fn(async () => ({ data: { user: null }, error: input.authUpdateError ?? null })),
      },
    },
  };

  return { admin, calls };
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

describe("Supabase auth lifecycle compensation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("restores the prior watermark and credential state when Auth reset fails late", async () => {
    const { admin, calls } = makeAdmin({
      profiles: [
        { data: { session_invalid_before: "2026-01-01T00:00:00.000Z" }, error: null },
        { error: null },
        { error: null },
      ],
      credentials: [
        { data: [{ id: "old-cred", state: "active", disabled_at: null }], error: null },
        { error: null },
        { data: { id: "new-cred" }, error: null },
        { error: null },
        { error: null },
      ],
      authUpdateError: { message: "auth update failed" },
    });

    const store = new SupabaseStore();
    vi.spyOn(store, "listUsers").mockResolvedValue([targetUser]);
    vi.spyOn(store as never, "admin" as never).mockReturnValue(admin as never);

    await expect(store.resetAccessCode(adminIdentity, targetUser.id))
      .rejects.toMatchObject({ message: "auth update failed" });

    const profileUpdates = calls.filter((call) => call.table === "profiles" && call.method === "update");
    expect(profileUpdates).toHaveLength(2);
    expect(profileUpdates[1].payload).toEqual({
      session_invalid_before: "2026-01-01T00:00:00.000Z",
    });

    expect(calls).toContainEqual({
      table: "access_credentials",
      method: "delete",
      payload: undefined,
    });
    expect(calls).toContainEqual({
      table: "access_credentials",
      method: "update",
      payload: { state: "active", disabled_at: null },
    });
  });

  it("surfaces credential bookkeeping failure without re-enabling a disabled profile", async () => {
    const { admin, calls } = makeAdmin({
      profiles: [{ error: null }],
      credentials: [{ error: { message: "credential update failed" } }],
    });

    const store = new SupabaseStore();
    vi.spyOn(store, "listUsers").mockResolvedValue([targetUser]);
    vi.spyOn(store as never, "admin" as never).mockReturnValue(admin as never);

    await expect(store.disableUser(adminIdentity, targetUser.id))
      .rejects.toMatchObject({ message: "credential update failed" });

    const profileUpdates = calls.filter((call) => call.table === "profiles" && call.method === "update");
    expect(profileUpdates).toHaveLength(1);
    expect(profileUpdates[0].payload).toMatchObject({ status: "disabled" });
  });
});
