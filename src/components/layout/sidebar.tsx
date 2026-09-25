"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardCheck, Compass, GraduationCap, Home, Megaphone, School, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { BasiraMark } from "@/components/brand/basira-mark";

export type NavIconName = "home" | "teachers" | "users" | "school" | "announcements" | "grading" | "subjects" | "journey" | "settings";
export interface NavItem { href: string; label: string; icon: NavIconName; mobile?: boolean; }

const icons = { home: Home, teachers: GraduationCap, users: Users, school: School, announcements: Megaphone, grading: ClipboardCheck, subjects: BookOpen, journey: Compass, settings: Settings } satisfies Record<NavIconName, typeof Home>;

export function Sidebar({ items, platformName, role }: { items: NavItem[]; platformName: string; role: string }) {
  const pathname = usePathname();
  return <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)] px-5 py-6 lg:flex">
    <div className="mb-7"><BasiraMark/><div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3"><span className="text-[11px] font-semibold tracking-[.08em] text-[var(--muted)]">{role}</span><span className="text-[10px] font-medium text-[var(--muted)]">{platformName}</span></div></div>
    <nav className="grid gap-1">{items.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); const Icon = icons[item.icon]; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("focus-ring flex min-h-11 items-center gap-3 rounded-md px-3 text-[13px] font-semibold transition", active ? "bg-[color-mix(in_srgb,var(--brand)_8%,transparent)] text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--text)]")}><Icon className="size-[18px]"/><span>{item.label}</span></Link>; })}</nav>
    <div className="mt-auto border-t border-[var(--border)] pt-4"><p className="text-[11px] font-semibold text-[var(--brand)]">بصيرة</p><p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">تعليم يُرى، ومسار يُفهم.</p></div>
  </aside>;
}
