import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoBackend: false }));
vi.mock("@/lib/auth/demo-session", () => ({
  clearDemoSession: vi.fn(),
  getDemoSession: vi.fn(),
  setDemoSession: vi.fn(),
}));
vi.mock("@/lib/demo/demo-db", () => ({
  mutateDemoDatabase: vi.fn(),
  verifySecret: vi.fn(),
  parseAccessCode: vi.fn((code: string) => {
    const normalized = code.trim().toUpperCase();
    const match = /^BSR-([A-Z0-9]{4})-([A-Z0-9]{8})$/.exec(normalized);
    return match ? { publicRef: match[1], secret: match[2] } : null;
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: vi.fn() }));

import { loginWithAccessCode } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type Credential = {
  id: string;
  auth_user_id: string;
  synthetic_email: string;
  role: string;
  state: string;
  first_used_at: string | null;
};

function makeClients(input?: {
  credential?: Partial<Credential> | null;
  credentialLookupError?: { message: string } | null;
  signInUserId?: string;
  signInError?: { message: string } | null;
  profile?: { display_name: string; role: string; status: string } | null;
  updateError?: { message: string } | null;
  activationResults?: Array<{ data: { id: string } | null; error: { message: string } | null }>;
}) {
  const credential: Credential | null = input?.credential === null ? null : {
    id: "cred-1",
    auth_user_id: "user-1",
    synthetic_email: "stored@example.invalid",
    role: "teacher",
    state: "unused",
    first_used_at: null,
    ...input?.credential,
  };

  const updatePayloads: unknown[] = [];
  const updateFilters: Array<[string, unknown]> = [];
  const activationResults = [...(input?.activationResults ?? [{
    data: { id: "cred-1" },
    error: input?.updateError ?? null,
  }])];
  let adminFromCall = 0;
  const admin = {
    from: vi.fn((table: string) => {
      if (table !== "access_credentials") throw new Error(`unexpected admin table ${table}`);
      adminFromCall += 1;

      if (adminFromCall === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: credential,
                error: input?.credentialLookupError ?? null,
              })),
            })),
          })),
        };
      }

      return {
        update: vi.fn((payload: unknown) => {
          updatePayloads.push(payload);
          const result = activationResults.shift() ?? { data: null, error: null };
          const builder = {
            eq: vi.fn((field: string, value: unknown) => {
              updateFilters.push([field, value]);
              return builder;
            }),
            neq: vi.fn(() => builder),
            is: vi.fn(() => builder),
            select: vi.fn(() => builder),
            maybeSingle: vi.fn(async () => result),
          };
          return builder;
        }),
      };
    }),
  };

  const signOut = vi.fn(async () => ({ error: null }));
  const signInWithPassword = vi.fn(async () => ({
    data: { user: input?.signInError ? null : { id: input?.signInUserId ?? "user-1" } },
    error: input?.signInError ?? null,
  }));
  const profile = input?.profile === null ? null : input?.profile ?? {
    display_name: "Teacher",
    role: "teacher",
    status: "active",
  };
  const server = {
    auth: { signInWithPassword, signOut },
    from: vi.fn((table: string) => {
      if (table !== "profiles") throw new Error(`unexpected server table ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: profile, error: null })),
          })),
        })),
      };
    }),
  };

  vi.mocked(createAdminSupabaseClient).mockReturnValue(
    admin as unknown as ReturnType<typeof createAdminSupabaseClient>,
  );
  vi.mocked(createServerSupabaseClient).mockResolvedValue(
    server as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
  );

  return { admin, server, signOut, signInWithPassword, updatePayloads, updateFilters };
}

describe("Supabase access-code login control plane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("resolves the stored credential before Auth and activates only that row", async () => {
    const ctx = makeClients();

    const result = await loginWithAccessCode("  bsr-ab12-cd34ef56  ");

    expect(result).toMatchObject({ ok: true, identity: { userId: "user-1", role: "teacher" } });
    expect(ctx.signInWithPassword).toHaveBeenCalledWith({
      email: "stored@example.invalid",
      password: "CD34EF56",
    });
    expect(ctx.updatePayloads).toHaveLength(1);
    expect(ctx.updatePayloads[0]).toMatchObject({ state: "active" });
    expect((ctx.updatePayloads[0] as Record<string, unknown>).first_used_at).toEqual(expect.any(String));
    expect(ctx.updateFilters).toEqual([
      ["id", "cred-1"],
      ["auth_user_id", "user-1"],
    ]);
  });

  it("preserves first_used_at on later logins", async () => {
    const ctx = makeClients({ credential: { state: "active", first_used_at: "2026-01-01T00:00:00.000Z" } });

    const result = await loginWithAccessCode("BSR-AB12-CD34EF56");

    expect(result.ok).toBe(true);
    expect(ctx.updatePayloads).toEqual([{ state: "active" }]);
  });

  it("rejects disabled credentials before creating an Auth session", async () => {
    const ctx = makeClients({ credential: { state: "disabled" } });

    const result = await loginWithAccessCode("BSR-AB12-CD34EF56");

    expect(result).toEqual({ ok: false, error: "رمز الدخول غير صالح" });
    expect(ctx.signInWithPassword).not.toHaveBeenCalled();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("fails closed when Auth user or profile role does not match the credential", async () => {
    const userMismatch = makeClients({ signInUserId: "different-user" });
    expect(await loginWithAccessCode("BSR-AB12-CD34EF56"))
      .toEqual({ ok: false, error: "رمز الدخول غير صالح" });
    expect(userMismatch.signOut).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    const roleMismatch = makeClients({ profile: { display_name: "Student", role: "student", status: "active" } });
    expect(await loginWithAccessCode("BSR-AB12-CD34EF56"))
      .toEqual({ ok: false, error: "رمز الدخول غير صالح" });
    expect(roleMismatch.signOut).toHaveBeenCalledTimes(1);
    expect(roleMismatch.updatePayloads).toHaveLength(0);
  });

  it("preserves a concurrent winner's first_used_at and retries without overwriting it", async () => {
    const ctx = makeClients({
      activationResults: [
        { data: null, error: null },
        { data: { id: "cred-1" }, error: null },
      ],
    });

    const result = await loginWithAccessCode("BSR-AB12-CD34EF56");

    expect(result.ok).toBe(true);
    expect(ctx.updatePayloads).toHaveLength(2);
    expect(ctx.updatePayloads[0]).toMatchObject({ state: "active", first_used_at: expect.any(String) });
    expect(ctx.updatePayloads[1]).toEqual({ state: "active" });
  });

  it("fails closed if the credential becomes disabled during activation", async () => {
    const ctx = makeClients({
      activationResults: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    });

    const result = await loginWithAccessCode("BSR-AB12-CD34EF56");

    expect(result).toEqual({ ok: false, error: "رمز الدخول غير صالح" });
    expect(ctx.signOut).toHaveBeenCalledTimes(1);
  });

  it("signs out and fails closed if exact credential activation fails", async () => {
    const ctx = makeClients({ updateError: { message: "write failed" } });

    const result = await loginWithAccessCode("BSR-AB12-CD34EF56");

    expect(result).toEqual({ ok: false, error: "رمز الدخول غير صالح" });
    expect(ctx.signOut).toHaveBeenCalledTimes(1);
  });
});
