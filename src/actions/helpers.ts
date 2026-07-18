import { redirect } from "next/navigation";
import { AppError } from "@/lib/data/errors";

export function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function returnPath(formData: FormData, fallback: string) {
  const value = formText(formData, "returnTo");
  return value.startsWith("/app") ? value : fallback;
}

export function redirectNotice(path: string, message: string, type: "notice" | "error" = "notice"): never {
  const url = new URL(path, "http://local");
  url.searchParams.set(type, message);
  redirect(`${url.pathname}${url.search}`);
}

export function handleActionError(error: unknown, path: string): never {
  console.error(error instanceof AppError ? `[${error.code}] ${error.message}` : error);
  const message = error instanceof AppError ? error.message : "حدث خطأ غير متوقع. حاول مرة أخرى.";
  redirectNotice(path, message, "error");
}
