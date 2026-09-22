import "server-only";
import { redirect } from "next/navigation";
import type { Identity, Role } from "@/domain/models";
import { isDemoBackend } from "@/lib/env";
import { clearDemoSession, getDemoSession, setDemoSession } from "./demo-session";
import { mutateDemoDatabase, parseAccessCode, verifySecret } from "@/lib/demo/demo-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type SupabaseAccessCredential = {
  id: string;
  auth_user_id: string;
  synthetic_email: string;
  role: string;
  state: string;
  first_used_at: string | null;
};

type SupabaseProfile = {
  display_name: string;
  role: string;
  status: string;
};

const invalidAccessCode = () => ({ ok: false, error: "رمز الدخول غير صالح" } as const);

async function resolveSupabaseCredential(publicRef: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("access_credentials")
    .select("id,auth_user_id,synthetic_email,role,state,first_used_at")
    .eq("public_account_ref", publicRef)
    .maybeSingle();

  if (error) console.error("Supabase access credential lookup failed", error.message);
  if (error || !data || data.state === "disabled") return null;

  return { admin, credential: data as SupabaseAccessCredential };
}

async function resolveActiveProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
): Promise<{ profile: SupabaseProfile; role: Role } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, role, status")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || data.status !== "active") return null;

  try {
    return { profile: data as SupabaseProfile, role: normalizeRole(String(data.role)) };
  } catch {
    return null;
  }
}

async function activateSupabaseCredential(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  credential: SupabaseAccessCredential,
  userId: string,
): Promise<boolean> {
  const activate = async (writeFirstUse: boolean) => {
    let query = admin
      .from("access_credentials")
      .update(writeFirstUse
        ? { state: "active", first_used_at: new Date().toISOString() }
        : { state: "active" })
      .eq("id", credential.id)
      .eq("auth_user_id", userId)
      .neq("state", "disabled");

    if (writeFirstUse) query = query.is("first_used_at", null);
    return query.select("id").maybeSingle();
  };

  let activation = await activate(!credential.first_used_at);
  if (!activation.error && !activation.data && !credential.first_used_at) {
    activation = await activate(false);
  }

  if (activation.error || !activation.data) {
    console.error(
      "Supabase access credential update failed",
      activation.error?.message ?? "Credential is no longer active",
    );
    return false;
  }
  return true;
}

export async function loginWithAccessCode(code: string): Promise<{ ok: true; identity: Identity } | { ok: false; error: string }> {
  const parsed = parseAccessCode(code);
  if (!parsed) return { ok: false, error: "رمز الدخول غير صالح" };

  if (isDemoBackend) {
    const identity = await mutateDemoDatabase((database) => {
      const credential = database.credentials.find((item) => item.publicRef === parsed.publicRef);
      const user = credential ? database.users.find((item) => item.id === credential.userId) : undefined;
      if (!credential || !user || credential.state === "disabled" || user.status === "disabled" || !verifySecret(parsed.secret, credential.secretHash)) return null;
      credential.state = "active";
      credential.firstUsedAt ??= new Date().toISOString();
      return { userId: user.id, displayName: user.displayName, role: user.role, status: user.status } satisfies Identity;
    });
    if (!identity) return { ok: false, error: "رمز الدخول غير صالح" };
    await setDemoSession(identity);
    return { ok: true, identity };
  }

  const resolvedCredential = await resolveSupabaseCredential(parsed.publicRef);
  if (!resolvedCredential) return invalidAccessCode();

  const { admin, credential } = resolvedCredential;
  const supabase = await createServerSupabaseClient();
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: credential.synthetic_email,
    password: parsed.secret,
  });
  if (signInError || !signInData.user) {
    console.error("Supabase access-code sign-in failed", signInError?.message ?? "No user returned");
    return invalidAccessCode();
  }

  if (signInData.user.id !== credential.auth_user_id) {
    await supabase.auth.signOut();
    console.error("Supabase access-code credential user mismatch");
    return invalidAccessCode();
  }

  const resolvedProfile = await resolveActiveProfile(supabase, signInData.user.id);
  if (!resolvedProfile) {
    await supabase.auth.signOut();
    return invalidAccessCode();
  }

  let credentialRole: Role;
  try {
    credentialRole = normalizeRole(credential.role);
  } catch {
    await supabase.auth.signOut();
    return invalidAccessCode();
  }

  if (resolvedProfile.role !== credentialRole) {
    await supabase.auth.signOut();
    console.error("Supabase access-code credential role mismatch");
    return invalidAccessCode();
  }

  if (!await activateSupabaseCredential(admin, credential, signInData.user.id)) {
    await supabase.auth.signOut();
    return invalidAccessCode();
  }

  return {
    ok: true,
    identity: {
      userId: signInData.user.id,
      displayName: resolvedProfile.profile.display_name,
      role: resolvedProfile.role,
      status: resolvedProfile.profile.status,
    },
  };
}

export function normalizeRole(value: string): Role {
  if (value === "admin" || value === "school_admin") return "admin";
  if (value === "teacher") return "teacher";
  if (value === "student") return "student";
  throw new Error(`Unsupported role: ${value}`);
}

export async function getIdentity(): Promise<Identity | null> {
  if (isDemoBackend) return getDemoSession();
  const supabase = await createServerSupabaseClient();
  const [{ data: { user } }, { data: { session } }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
  if (!user || !session) return null;
  const { data: profile } = await supabase.from("profiles").select("display_name, role, status, session_invalid_before").eq("id", user.id).maybeSingle();
  if (!profile || profile.status === "disabled") return null;
  const payload = JSON.parse(Buffer.from(session.access_token.split(".")[1] ?? "", "base64url").toString("utf8")) as { iat?: number };
  const invalidBefore = new Date(profile.session_invalid_before).getTime();
  if (!payload.iat || payload.iat * 1000 < invalidBefore - 1000) { await supabase.auth.signOut(); return null; }
  return { userId: user.id, displayName: profile.display_name, role: normalizeRole(profile.role), status: profile.status };
}

export async function requireIdentity() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");
  return identity;
}

export async function requireRole(...roles: Role[]) {
  const identity = await requireIdentity();
  if (!roles.includes(identity.role)) redirect(`/app/${identity.role}`);
  return identity;
}

export async function logout() {
  if (isDemoBackend) await clearDemoSession();
  else await (await createServerSupabaseClient()).auth.signOut();
}
