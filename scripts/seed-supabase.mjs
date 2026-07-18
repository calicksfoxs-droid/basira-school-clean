import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const token = (length) => Array.from(randomBytes(length), (byte) => alphabet[byte % alphabet.length]).join("");
const makeCode = () => {
  const publicRef = token(4);
  const secret = token(8);
  return { publicRef, secret, full: `BSR-${publicRef}-${secret}`, email: `basira.${publicRef.toLowerCase()}@access.invalid` };
};

async function createInitialAdmin() {
  const displayName = process.env.BASIRA_INITIAL_ADMIN_NAME?.trim() || "مدير بصيرة";
  const { data: existing, error: existingError } = await admin.from("profiles").select("id,display_name").eq("role", "admin").limit(1).maybeSingle();
  if (existingError) throw existingError;
  const reset = process.argv.includes("--reset-admin");
  if (existing && !reset) {
    console.log(`Admin already exists: ${existing.display_name}. Run with --reset-admin to rotate its access code.`);
    return;
  }

  const generated = makeCode();
  if (!existing) {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: generated.email,
      password: generated.secret,
      email_confirm: true,
      user_metadata: { display_name: displayName, role: "admin" },
    });
    if (authError || !authData.user) throw authError ?? new Error("Auth user was not created");
    try {
      const { error: profileError } = await admin.from("profiles").insert({ id: authData.user.id, display_name: displayName, role: "admin", status: "active", created_by: null, session_invalid_before: new Date().toISOString() });
      if (profileError) throw profileError;
      const { error: credentialError } = await admin.from("access_credentials").insert({ auth_user_id: authData.user.id, public_account_ref: generated.publicRef, synthetic_email: generated.email, role: "admin", state: "unused", code_hint: `BSR-${generated.publicRef}-••••••••`, issued_by: authData.user.id });
      if (credentialError) throw credentialError;
    } catch (error) {
      await admin.auth.admin.deleteUser(authData.user.id);
      throw error;
    }
  } else {
    const timestamp = new Date().toISOString();
    const { error: profileError } = await admin.from("profiles").update({ session_invalid_before: timestamp, status: "active" }).eq("id", existing.id);
    if (profileError) throw profileError;
    const { error: disableError } = await admin.from("access_credentials").update({ state: "disabled", disabled_at: timestamp }).eq("auth_user_id", existing.id).neq("state", "disabled");
    if (disableError) throw disableError;
    const { error: credentialError } = await admin.from("access_credentials").insert({ auth_user_id: existing.id, public_account_ref: generated.publicRef, synthetic_email: generated.email, role: "admin", state: "unused", code_hint: `BSR-${generated.publicRef}-••••••••`, issued_by: existing.id, last_reset_at: timestamp });
    if (credentialError) throw credentialError;
    const { error: authError } = await admin.auth.admin.updateUserById(existing.id, { email: generated.email, password: generated.secret, email_confirm: true });
    if (authError) throw authError;
  }

  console.log("Initial Admin access code (displayed once):");
  console.log(generated.full);
  console.log("Store it securely and rotate it after acceptance testing.");
}

createInitialAdmin().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
