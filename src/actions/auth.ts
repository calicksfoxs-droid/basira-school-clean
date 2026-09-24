"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { accessCodeSchema } from "@/domain/schemas";
import { loginWithAccessCode, logout } from "@/lib/auth";
import { roleHome } from "@/lib/utils";
import { beginLoginAttempt, clearLoginAttempts } from "@/lib/auth/login-rate-limit";

export async function loginAction(formData: FormData) {
  const parsed = accessCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) redirect(`/login?error=${encodeURIComponent("رمز الدخول غير صالح")}`);
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = requestHeaders.get("cf-connecting-ip") || forwarded || requestHeaders.get("x-real-ip") || "unknown";
  const publicRef = parsed.data.slice(4, 8);
  const rateKey = `${clientAddress}:${publicRef}`;
  const rate = await beginLoginAttempt(rateKey);
  if (!rate.allowed) redirect(`/login?error=${encodeURIComponent("محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.")}`);
  const result = await loginWithAccessCode(parsed.data);
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.error)}`);
  await clearLoginAttempts(rateKey);
  redirect(roleHome(result.identity.role));
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
