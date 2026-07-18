import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-QA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function roleLabel(role: "admin" | "teacher" | "student") {
  return role === "admin" ? "المدير" : role === "teacher" ? "المعلم" : "الطالب";
}

export function roleHome(role: "admin" | "teacher" | "student") {
  return `/app/${role}`;
}

export function safeInternalPath(path?: string) {
  return path?.startsWith("/app") ? path : undefined;
}
