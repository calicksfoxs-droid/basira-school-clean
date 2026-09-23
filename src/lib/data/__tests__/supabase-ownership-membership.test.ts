import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

import { SupabaseStore } from "@/lib/data/supabase-store";
import type { Identity } from "@/domain/models";

type Response = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

type Call = {
  table: string;
  method: string;
  payload?: unknown;
};

function makeClient(queues: Record<string, Response[]>) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const response = queues[table]?.shift();
    if (!response) throw new Error(`Unexpected query for ${table}`);

    const builder: Record<string, unknown> = {};
    for (const method of [
      "select", "update", "insert", "upsert", "delete",
      "eq", "neq", "in", "order",
    ]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({
          table,
          method,
          payload: args.length === 1 ? args[0] : args,
        });
        return builder;
      };
    }

    builder.single = async () => response;
    builder.maybeSingle = async () => response;
    builder.then = (
      onFulfilled: (value: Response) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(response).then(onFulfilled, onRejected);

    return builder;
  });

  return { client: { from }, calls, from };
}

function installClients(store: SupabaseStore, admin: unknown, user: unknown) {
  const privateStore = store as unknown as {
    admin: () => typeof admin;
    client: () => Promise<typeof user>;
  };
  vi.spyOn(privateStore, "admin").mockReturnValue(admin);
  vi.spyOn(privateStore, "client").mockResolvedValue(user);
  return privateStore;
}

const adminIdentity: Identity = {
  userId: "admin-1",
  displayName: "Admin",
  role: "admin",
  status: "active",
};

const studentIdentity: Identity = {
  userId: "student-1",
  displayName: "Student",
  role: "student",
  status: "active",
};

describe("SupabaseStore ownership and legacy visibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects generic transfer of a subject-linked group before writing", async () => {
    const adminMock = makeClient({
      profiles: [{ data: { id: "teacher-2" }, error: null }],
      groups: [{ data: { id: "group-1", subject_id: "subject-root" }, error: null }],
    });
    const userMock = makeClient({});
    const store = new SupabaseStore();
    const privateStore = installClients(store, adminMock.client, userMock.client);

    await expect(store.transferGroup(adminIdentity, "group-1", "teacher-2"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(privateStore.client).not.toHaveBeenCalled();
  });

  it("rejects membership activation when target is not an active student", async () => {
    const adminMock = makeClient({
      groups: [{
        data: {
          id: "group-1",
          name: "Group",
          owner_teacher_id: "teacher-1",
          status: "active",
          description: null,
          created_by: "admin-1",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        error: null,
      }],
      profiles: [{ data: null, error: null }],
    });
    const store = new SupabaseStore();
    installClients(store, adminMock.client, makeClient({}).client);

    await expect(store.addStudentToGroup(
      { userId: "teacher-1", displayName: "Teacher", role: "teacher", status: "active" },
      "group-1",
      "teacher-2",
    )).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(adminMock.from).not.toHaveBeenCalledWith("group_memberships");
  });

  it("returns a user-scoped client for an authorized student legacy subject", async () => {
    const adminMock = makeClient({
      subjects: [{
        data: {
          id: "subject-1",
          group_id: "group-1",
          owner_teacher_id: "teacher-1",
          title: "Subject",
          description: null,
          display_order: 1,
          status: "active",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        error: null,
      }],
      groups: [{ data: [{ id: "group-1" }], error: null }],
      group_memberships: [{ data: null, error: null, count: 1 }],
    });
    const userMock = makeClient({});
    const store = new SupabaseStore();
    const privateStore = installClients(store, adminMock.client, userMock.client) as unknown as {
      subjectForAccess: (
        identity: Identity,
        subjectId: string,
      ) => Promise<{ client: unknown; subject: unknown }>;
    };

    const resolved = await privateStore.subjectForAccess(studentIdentity, "subject-1");

    expect(resolved.client).toBe(userMock.client);
  });

  it("uses the user client and a published-only filter for student direct lesson reads", async () => {
    const adminMock = makeClient({});
    const userMock = makeClient({
      lessons: [{ data: null, error: { message: "not found" } }],
    });
    const store = new SupabaseStore();
    const privateStore = installClients(store, adminMock.client, userMock.client);

    await expect(store.getLesson(studentIdentity, "draft-lesson"))
      .rejects.toMatchObject({ message: "not found" });

    expect(privateStore.client).toHaveBeenCalledTimes(1);
    expect(adminMock.from).not.toHaveBeenCalled();

    expect(userMock.calls).toContainEqual({
      table: "lessons",
      method: "eq",
      payload: ["status", "published"],
    });
  });
});
