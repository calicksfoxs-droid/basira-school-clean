"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { accessCodeSchema } from "@/domain/schemas";
import { loginWithAccessCode, logout } from "@/lib/auth";
import { roleHome } from "@/lib/utils";
import { checkLoginRateLimit, clearLoginFailures, recordLoginFailure } from "@/lib/auth/login-rate-limit";

export async function loginAction(formData: FormData) {
  const parsed = accessCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) redirect(`/login?error=${encodeURIComponent("رمز الدخول غير صالح")}`);
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  const publicRef = parsed.data.slice(4, 8);
  const rateKey = `${clientAddress}:${publicRef}`;
  const rate = checkLoginRateLimit(rateKey);
  if (!rate.allowed) redirect(`/login?error=${encodeURIComponent("محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.")}`);
  const result = await loginWithAccessCode(parsed.data);
  if (!result.ok) {
    recordLoginFailure(rateKey);
    redirect(`/login?error=${encodeURIComponent(result.error)}`);
  }
  clearLoginFailures(rateKey);
  redirect(roleHome(result.identity.role));
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
