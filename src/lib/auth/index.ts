import "server-only";
import { redirect } from "next/navigation";
import type { Identity, Role } from "@/domain/models";
import { isDemoBackend } from "@/lib/env";
import { clearDemoSession, getDemoSession, setDemoSession } from "./demo-session";
import { mutateDemoDatabase, parseAccessCode, verifySecret } from "@/lib/demo/demo-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

  const supabase = await createServerSupabaseClient();
  const email = `basira.${parsed.publicRef.toLowerCase()}@access.invalid`;
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password: parsed.secret });
  if (signInError || !signInData.user) {
    console.error("Supabase access-code sign-in failed", signInError?.message ?? "No user returned");
    return { ok: false, error: "رمز الدخول غير صالح" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, role, status")
    .eq("id", signInData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.status === "disabled") {
    await supabase.auth.signOut();
    return { ok: false, error: "رمز الدخول غير صالح" };
  }

  const admin = createAdminSupabaseClient();
  const { error: credentialUpdateError } = await admin
    .from("access_credentials")
    .update({ state: "active", first_used_at: new Date().toISOString() })
    .eq("auth_user_id", signInData.user.id);
  if (credentialUpdateError) console.error("Supabase access credential update failed", credentialUpdateError.message);

  return {
    ok: true,
    identity: { userId: signInData.user.id, displayName: profile.display_name, role: normalizeRole(profile.role), status: profile.status },
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
