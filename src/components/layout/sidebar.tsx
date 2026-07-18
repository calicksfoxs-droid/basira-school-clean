"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, GraduationCap, Home, Megaphone, School, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavIconName = "home" | "teachers" | "users" | "school" | "announcements" | "grading";
export interface NavItem { href: string; label: string; icon: NavIconName; }

const icons = {
  home: Home,
  teachers: GraduationCap,
  users: Users,
  school: School,
  announcements: Megaphone,
  grading: ClipboardCheck,
} satisfies Record<NavIconName, typeof Home>;

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-white p-4 lg:block"><div className="mb-6 rounded-2xl bg-[#0b1d33] p-4 text-white"><div className="text-xl font-black">بصيرة</div><p className="mt-1 text-xs text-white/65">منصة تعليمية خاصة</p></div><nav className="grid gap-1">{items.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); const Icon = icons[item.icon]; return <Link key={item.href} href={item.href} className={cn("focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition", active ? "bg-sky-50 text-[#1479b8]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950")}><Icon className="size-5"/>{item.label}</Link>; })}</nav></aside>;
}
