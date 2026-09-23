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

import type { Identity } from "@/domain/models";
import { SupabaseStore } from "@/lib/data/supabase-store";

type Result = { data?: unknown; error?: unknown };
type Queued = Result | { throw: unknown };

const adminIdentity: Identity = {
  userId: "00000000-0000-4000-8000-000000000001",
  displayName: "Admin",
  role: "admin",
  status: "active",
};

const teacherIdentity: Identity = {
  userId: "00000000-0000-4000-8000-000000000002",
  displayName: "Teacher",
  role: "teacher",
  status: "active",
};

const requestId = "90000000-0000-4000-8000-000000000001";
const authUserId = "91000000-0000-4000-8000-000000000001";
const groupId = "92000000-0000-4000-8000-000000000001";
const syntheticEmail = "basira.91000000000040008000000000000001@access.invalid";

type OperationFixture = {
  request_id: string;
  actor_id: string;
  auth_user_id: string;
  target_role: string;
  group_id: string | null;
  display_name: string;
  public_account_ref: string;
  synthetic_email: string;
  contact_number: string | null;
  state: "prepared" | "complete" | "cleanup_pending" | "cleaned";
  cleanup_error: string | null;
};

function op(
  state: "prepared" | "complete" | "cleanup_pending" | "cleaned" = "prepared",
): OperationFixture {
  return {
    request_id: requestId,
    actor_id: adminIdentity.userId,
    auth_user_id: authUserId,
    target_role: "teacher",
    group_id: null,
    display_name: "Teacher New",
    public_account_ref: "ZX90",
    synthetic_email: syntheticEmail,
    contact_number: null,
    state,
    cleanup_error: state === "cleanup_pending" ? "pending" : null,
  };
}

function studentOp(
  actorId = teacherIdentity.userId,
  state: "prepared" | "complete" | "cleanup_pending" = "prepared",
): OperationFixture {
  return {
    request_id: requestId,
    actor_id: actorId,
    auth_user_id: authUserId,
    target_role: "student",
    group_id: groupId,
    display_name: "Student New",
    public_account_ref: "ZX90",
    synthetic_email: syntheticEmail,
    contact_number: "55500000",
    state,
    cleanup_error: null,
  };
}

function missingUser() {
  return {
    data: { user: null },
    error: { status: 404, code: "user_not_found", message: "not found" },
  };
}

function presentUser(operation: OperationFixture = op()) {
  return {
    data: {
      user: {
        id: operation.auth_user_id,
        email: operation.synthetic_email,
        app_metadata: { basira_creation_request_id: operation.request_id },
      },
    },
    error: null,
  };
}

function createFakeAdmin(input: {
  rpc?: Record<string, Queued[]>;
  groups?: Queued[];
  getUser?: Queued[];
  createUser?: Queued[];
  deleteUser?: Queued[];
}) {
  const rpcQueues = Object.fromEntries(
    Object.entries(input.rpc ?? {}).map(([key, values]) => [key, [...values]]),
  ) as Record<string, Queued[]>;
  const groupQueue = [...(input.groups ?? [])];
  const getUserQueue = [...(input.getUser ?? [])];
  const createUserQueue = [...(input.createUser ?? [])];
  const deleteUserQueue = [...(input.deleteUser ?? [])];

  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const fromCalls: string[] = [];

  const resolveQueued = async (queue: Queued[], label: string): Promise<Result> => {
    const next = queue.shift();
    if (!next) throw new Error(`Unexpected ${label} call`);
    if ("throw" in next) throw next.throw;
    return next;
  };

  const rpc = vi.fn((name: string, args: unknown) => {
    rpcCalls.push({ name, args });
    const execute = async () => {
      const queue = rpcQueues[name] ?? [];
      if (name === "get_account_creation_operation_v1" && queue.length === 0) {
        return { data: null, error: null };
      }
      return resolveQueued(queue, `rpc ${name}`);
    };
    return {
      single: execute,
      maybeSingle: execute,
    };
  });

  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    if (table !== "groups") throw new Error(`Unexpected table ${table}`);
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(() => resolveQueued(groupQueue, "group query")),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    return builder;
  });

  const getUserById = vi.fn(() => resolveQueued(getUserQueue, "getUserById"));
  const createUser = vi.fn(() => resolveQueued(createUserQueue, "createUser"));
  const deleteUser = vi.fn(() => resolveQueued(deleteUserQueue, "deleteUser"));

  return {
    admin: {
      rpc,
      from,
      auth: { admin: { getUserById, createUser, deleteUser } },
    },
    rpcCalls,
    fromCalls,
    getUserById,
    createUser,
    deleteUser,
  };
}

function installAdmin(store: SupabaseStore, admin: unknown) {
  const privateStore = store as unknown as { admin: () => typeof admin };
  vi.spyOn(privateStore, "admin").mockReturnValue(admin);
}

function teacherInput() {
  return { creationRequestId: requestId, displayName: "Teacher New" };
}

describe("Supabase account creation provisioning", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("rejects non-admin Teacher creation before any Auth or DB side effect", async () => {
    const store = new SupabaseStore();
    const privateStore = store as unknown as { admin: () => unknown };
    const adminSpy = vi.spyOn(privateStore, "admin");

    await expect(store.createTeacher(teacherIdentity, teacherInput()))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(adminSpy).not.toHaveBeenCalled();
  });

  it("rejects Teacher Student creation in a foreign Group before Auth creation", async () => {
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{
          data: null,
          error: { message: "Teacher does not own target Group" },
        }],
      },
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createStudent(teacherIdentity, {
      creationRequestId: requestId,
      displayName: "Student New",
      groupId,
    })).rejects.toMatchObject({ message: "Teacher does not own target Group" });

    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.rpcCalls.map((call) => call.name)).toEqual([
      "get_account_creation_operation_v1",
      "prepare_account_creation_v1",
    ]);
  });

  it("rejects an inactive Group during application preflight before Auth creation", async () => {
    const prepared = studentOp();
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{ data: prepared, error: null }],
      },
      groups: [{
        data: { id: groupId, owner_teacher_id: teacherIdentity.userId, status: "archived" },
        error: null,
      }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createStudent(teacherIdentity, {
      creationRequestId: requestId,
      displayName: "Student New",
      groupId,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(fake.createUser).not.toHaveBeenCalled();
  });

  it("marks a definite Auth-create failure clean when reconciliation proves absence", async () => {
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{ data: op(), error: null }],
        set_account_creation_cleanup_v1: [{ data: { state: "cleaned" }, error: null }],
      },
      getUser: [missingUser(), missingUser()],
      createUser: [{ data: { user: null }, error: { status: 400, message: "auth rejected" } }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createTeacher(adminIdentity, teacherInput()))
      .rejects.toMatchObject({ message: "auth rejected" });

    expect(fake.rpcCalls.map((call) => call.name)).toEqual([
      "get_account_creation_operation_v1",
      "prepare_account_creation_v1",
      "set_account_creation_cleanup_v1",
    ]);
    expect(fake.rpcCalls.find((call) => call.name === "set_account_creation_cleanup_v1")?.args)
      .toMatchObject({ p_state: "cleaned" });
  });

  it("keeps a transport-ambiguous Auth create prepared when immediate lookup is still absent", async () => {
    const prepared = op();
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{ data: prepared, error: null }],
      },
      getUser: [missingUser(), missingUser()],
      createUser: [{ throw: new Error("transport lost") }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createTeacher(adminIdentity, teacherInput()))
      .rejects.toMatchObject({ code: "ACCOUNT_CREATION_RECONCILIATION_PENDING" });

    expect(fake.rpcCalls.map((call) => call.name)).toEqual([
      "get_account_creation_operation_v1",
      "prepare_account_creation_v1",
    ]);
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("reconciles an ambiguous Auth create by known UUID, provisions once, then resets to a known code", async () => {
    const prepared = op();
    const complete = op("complete");
    const fake = createFakeAdmin({
      rpc: {
        get_account_creation_operation_v1: [{ data: prepared, error: null }],
        provision_account_v1: [{ data: complete, error: null }],
      },
      getUser: [missingUser(), presentUser(prepared)],
      createUser: [{ throw: new Error("transport lost") }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);
    const resetSpy = vi.spyOn(store, "resetAccessCode").mockResolvedValue({
      user: {
        id: authUserId,
        displayName: "Teacher New",
        role: "teacher",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      code: "BSR-NEWW-NEWCODE1",
    });

    const result = await store.createTeacher(adminIdentity, teacherInput());

    expect(result.code).toBe("BSR-NEWW-NEWCODE1");
    expect(fake.createUser).toHaveBeenCalledTimes(1);
    expect(resetSpy).toHaveBeenCalledWith(adminIdentity, authUserId);
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("keeps a committed account when the provisioning response is lost", async () => {
    const prepared = op();
    const complete = op("complete");
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{ data: prepared, error: null }],
        provision_account_v1: [{ throw: new Error("rpc response lost") }],
        get_account_creation_operation_v1: [
          { data: null, error: null },
          { data: complete, error: null },
        ],
      },
      getUser: [missingUser()],
      createUser: [{
        data: { user: { id: authUserId, email: syntheticEmail } },
        error: null,
      }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    const result = await store.createTeacher(adminIdentity, teacherInput());

    expect(result).toMatchObject({
      user: { id: authUserId, role: "teacher" },
      code: "BSR-ZX90-AB12CD34",
    });
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("compensates Auth after a definite DB failure and records clean cleanup", async () => {
    const prepared = op();
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{ data: prepared, error: null }],
        provision_account_v1: [{ data: null, error: { message: "db rejected" } }],
        get_account_creation_operation_v1: [
          { data: null, error: null },
          { data: prepared, error: null },
        ],
        set_account_creation_cleanup_v1: [{ data: { state: "cleaned" }, error: null }],
      },
      getUser: [missingUser()],
      createUser: [{
        data: { user: { id: authUserId, email: syntheticEmail } },
        error: null,
      }],
      deleteUser: [{ data: { user: null }, error: null }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createTeacher(adminIdentity, teacherInput()))
      .rejects.toMatchObject({ message: "db rejected" });

    expect(fake.deleteUser).toHaveBeenCalledWith(authUserId);
    expect(fake.rpcCalls.find((call) => call.name === "set_account_creation_cleanup_v1")?.args)
      .toMatchObject({ p_state: "cleaned" });
  });

  it("records cleanup_pending and reveals no code when Auth deletion cannot be confirmed", async () => {
    const prepared = op();
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{ data: prepared, error: null }],
        provision_account_v1: [{ data: null, error: { message: "db rejected" } }],
        get_account_creation_operation_v1: [
          { data: null, error: null },
          { data: prepared, error: null },
        ],
        set_account_creation_cleanup_v1: [{ data: { state: "cleanup_pending" }, error: null }],
      },
      getUser: [missingUser(), presentUser(prepared)],
      createUser: [{
        data: { user: { id: authUserId, email: syntheticEmail } },
        error: null,
      }],
      deleteUser: [{ data: null, error: { message: "delete timeout" } }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createTeacher(adminIdentity, teacherInput()))
      .rejects.toMatchObject({ code: "ACCOUNT_CREATION_RECOVERY_PENDING" });

    expect(fake.rpcCalls.find((call) => call.name === "set_account_creation_cleanup_v1")?.args)
      .toMatchObject({ p_state: "cleanup_pending" });
  });

  it("does not delete Auth when DB reconciliation itself is unavailable", async () => {
    const prepared = op();
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{ data: prepared, error: null }],
        provision_account_v1: [{ throw: new Error("rpc timeout") }],
        get_account_creation_operation_v1: [
          { data: null, error: null },
          { throw: new Error("reconcile timeout") },
        ],
      },
      getUser: [missingUser()],
      createUser: [{
        data: { user: { id: authUserId, email: syntheticEmail } },
        error: null,
      }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createTeacher(adminIdentity, teacherInput()))
      .rejects.toMatchObject({ code: "ACCOUNT_CREATION_RECONCILIATION_PENDING" });

    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("retries a completed request by resetting the existing account without creating another Auth user", async () => {
    const complete = op("complete");
    const fake = createFakeAdmin({
      rpc: {
        get_account_creation_operation_v1: [{ data: complete, error: null }],
      },
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);
    const resetSpy = vi.spyOn(store, "resetAccessCode").mockResolvedValue({
      user: {
        id: authUserId,
        displayName: "Teacher New",
        role: "teacher",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      code: "BSR-RTRY-RETRY001",
    });

    const result = await store.createTeacher(adminIdentity, teacherInput());

    expect(result.code).toBe("BSR-RTRY-RETRY001");
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it("continues a prepared retry with the existing known Auth user instead of creating a duplicate", async () => {
    const prepared = op();
    const complete = op("complete");
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [{ data: prepared, error: null }],
        provision_account_v1: [{ data: complete, error: null }],
      },
      getUser: [presentUser(prepared)],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);
    const resetSpy = vi.spyOn(store, "resetAccessCode").mockResolvedValue({
      user: {
        id: authUserId,
        displayName: "Teacher New",
        role: "teacher",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      code: "BSR-RTRY-RETRY002",
    });

    await store.createTeacher(adminIdentity, teacherInput());

    expect(fake.createUser).not.toHaveBeenCalled();
    expect(resetSpy).toHaveBeenCalledWith(adminIdentity, authUserId);
  });

  it("retries publicRef collisions without changing the logical request", async () => {
    const complete = op("complete");
    complete.public_account_ref = "ZX91";
    const fake = createFakeAdmin({
      rpc: {
        prepare_account_creation_v1: [
          { data: null, error: { code: "23505", message: "collision" } },
          { data: complete, error: null },
        ],
      },
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);
    vi.spyOn(store, "resetAccessCode").mockResolvedValue({
      user: {
        id: authUserId,
        displayName: "Teacher New",
        role: "teacher",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      code: "BSR-RTRY-RETRY003",
    });

    await store.createTeacher(adminIdentity, teacherInput());

    const prepareCalls = fake.rpcCalls.filter((call) => call.name === "prepare_account_creation_v1");
    expect(prepareCalls).toHaveLength(2);
    expect(prepareCalls[0].args).toMatchObject({ p_request_id: requestId });
    expect(prepareCalls[1].args).toMatchObject({ p_request_id: requestId });
  });

  it("cleans a prior cleanup_pending Auth residue before rejecting a now-inactive Group", async () => {
    const pending = studentOp(teacherIdentity.userId, "cleanup_pending");
    const fake = createFakeAdmin({
      rpc: {
        get_account_creation_operation_v1: [{ data: pending, error: null }],
        set_account_creation_cleanup_v1: [{ data: { state: "cleaned" }, error: null }],
      },
      deleteUser: [{ data: { user: null }, error: null }],
      groups: [{
        data: { id: groupId, owner_teacher_id: teacherIdentity.userId, status: "archived" },
        error: null,
      }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createStudent(teacherIdentity, {
      creationRequestId: requestId,
      displayName: "Student New",
      groupId,
      contactNumber: "55500000",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(fake.deleteUser).toHaveBeenCalledWith(authUserId);
    expect(fake.rpcCalls.find((call) => call.name === "set_account_creation_cleanup_v1")?.args)
      .toMatchObject({ p_state: "cleaned" });
    expect(fake.createUser).not.toHaveBeenCalled();
  });

  it("recovers a prepared Auth residue before rejecting a Group that became inactive", async () => {
    const prepared = studentOp();
    const fake = createFakeAdmin({
      rpc: {
        get_account_creation_operation_v1: [{ data: prepared, error: null }],
        set_account_creation_cleanup_v1: [{ data: { state: "cleaned" }, error: null }],
      },
      getUser: [presentUser(prepared)],
      groups: [{
        data: { id: groupId, owner_teacher_id: teacherIdentity.userId, status: "archived" },
        error: null,
      }],
      deleteUser: [{ data: { user: null }, error: null }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    await expect(store.createStudent(teacherIdentity, {
      creationRequestId: requestId,
      displayName: "Student New",
      groupId,
      contactNumber: "55500000",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(fake.deleteUser).toHaveBeenCalledWith(authUserId);
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.rpcCalls.some((call) => call.name === "provision_account_v1")).toBe(false);
    expect(fake.rpcCalls.find((call) => call.name === "set_account_creation_cleanup_v1")?.args)
      .toMatchObject({ p_state: "cleaned" });
  });

  it("recovers on a later retry after DB reconciliation was previously unavailable", async () => {
    const prepared = studentOp();
    const fake = createFakeAdmin({
      rpc: {
        get_account_creation_operation_v1: [
          { data: null, error: null },
          { throw: new Error("reconcile timeout") },
          { data: prepared, error: null },
        ],
        prepare_account_creation_v1: [{ data: prepared, error: null }],
        provision_account_v1: [{ throw: new Error("rpc timeout") }],
        set_account_creation_cleanup_v1: [{ data: { state: "cleaned" }, error: null }],
      },
      getUser: [missingUser(), presentUser(prepared)],
      createUser: [{
        data: { user: { id: authUserId, email: syntheticEmail } },
        error: null,
      }],
      groups: [
        { data: { id: groupId, owner_teacher_id: teacherIdentity.userId, status: "active" }, error: null },
        { data: { id: groupId, owner_teacher_id: teacherIdentity.userId, status: "archived" }, error: null },
      ],
      deleteUser: [{ data: { user: null }, error: null }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);
    const input = {
      creationRequestId: requestId,
      displayName: "Student New",
      groupId,
      contactNumber: "55500000",
    };

    await expect(store.createStudent(teacherIdentity, input))
      .rejects.toMatchObject({ code: "ACCOUNT_CREATION_RECONCILIATION_PENDING" });

    expect(fake.deleteUser).not.toHaveBeenCalled();

    await expect(store.createStudent(teacherIdentity, input))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(fake.deleteUser).toHaveBeenCalledWith(authUserId);
    expect(fake.createUser).toHaveBeenCalledTimes(1);
    expect(fake.rpcCalls.filter((call) => call.name === "provision_account_v1")).toHaveLength(1);
  });

  it("retries prepared recovery after cleanup-state persistence failed", async () => {
    const prepared = studentOp();
    const fake = createFakeAdmin({
      rpc: {
        get_account_creation_operation_v1: [
          { data: prepared, error: null },
          { data: prepared, error: null },
        ],
        set_account_creation_cleanup_v1: [
          { data: null, error: { message: "ledger write failed" } },
          { data: { state: "cleaned" }, error: null },
        ],
      },
      getUser: [
        presentUser(prepared),
        presentUser(prepared),
        presentUser(prepared),
      ],
      groups: [
        { data: { id: groupId, owner_teacher_id: teacherIdentity.userId, status: "archived" }, error: null },
        { data: { id: groupId, owner_teacher_id: teacherIdentity.userId, status: "archived" }, error: null },
      ],
      deleteUser: [
        { data: null, error: { message: "delete timeout" } },
        { data: { user: null }, error: null },
      ],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);
    const input = {
      creationRequestId: requestId,
      displayName: "Student New",
      groupId,
      contactNumber: "55500000",
    };

    await expect(store.createStudent(teacherIdentity, input))
      .rejects.toMatchObject({ code: "ACCOUNT_CREATION_RECOVERY_PENDING" });

    await expect(store.createStudent(teacherIdentity, input))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(fake.deleteUser).toHaveBeenCalledTimes(2);
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.rpcCalls.some((call) => call.name === "provision_account_v1")).toBe(false);
  });

  it("allows Teacher Student creation only after active owned-Group preflight", async () => {
    const prepared = studentOp();
    const complete = studentOp(teacherIdentity.userId, "complete");
    const fake = createFakeAdmin({
      groups: [{
        data: { id: groupId, owner_teacher_id: teacherIdentity.userId, status: "active" },
        error: null,
      }],
      rpc: {
        prepare_account_creation_v1: [{ data: prepared, error: null }],
        provision_account_v1: [{ data: complete, error: null }],
      },
      getUser: [missingUser()],
      createUser: [{
        data: { user: { id: authUserId, email: syntheticEmail } },
        error: null,
      }],
    });
    const store = new SupabaseStore();
    installAdmin(store, fake.admin);

    const result = await store.createStudent(teacherIdentity, {
      creationRequestId: requestId,
      displayName: "Student New",
      groupId,
      contactNumber: "55500000",
    });

    expect(result.user).toMatchObject({ id: authUserId, role: "student" });
    expect(fake.createUser).toHaveBeenCalledTimes(1);
  });
});
