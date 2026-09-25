"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardCheck, Compass, GraduationCap, Home, Megaphone, School, Settings, Users } from "lucide-react";
import { activeDestination } from "./nav-active";
import { cn } from "@/lib/utils";

export type NavIconName = "home" | "teachers" | "users" | "school" | "announcements" | "grading" | "subjects" | "journey" | "settings";
export interface NavItem { href: string; label: string; icon: NavIconName; mobile?: boolean; }

const icons = { home: Home, teachers: GraduationCap, users: Users, school: School, announcements: Megaphone, grading: ClipboardCheck, subjects: BookOpen, journey: Compass, settings: Settings } satisfies Record<NavIconName, typeof Home>;

export function Sidebar({ items, platformName, role }: { items: NavItem[]; platformName: string; role: string }) {
  const pathname = usePathname();
  const current = activeDestination(pathname, items);
  return <aside className="basira-sidebar sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)] px-6 py-8 lg:flex"><div className="mb-6"><div className="font-heading text-[28px] font-bold text-[var(--text)]">{platformName}</div><p className="mt-1 text-xs text-[var(--muted)]">{role}</p></div><div className="mb-5 h-px bg-[var(--border)]"/><p className="mb-3 text-[11px] font-bold text-[var(--muted)]">مساحتك التعليمية</p><nav aria-label="التنقل الرئيسي" className="grid gap-2">{items.map((item) => { const active = current === item.href; const Icon = icons[item.icon]; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("nav-link focus-ring flex min-h-12 items-center justify-start gap-3 rounded-xl px-3 text-sm font-bold transition", active ? "bg-[var(--soft)] text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--text)]")}><Icon className="size-5"/><span>{item.label}</span></Link>; })}</nav><div className="mt-auto rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-4"><p className="text-xs font-bold text-[var(--accent)]">بصيرة</p><p className="mt-1 text-xs leading-6 text-[var(--muted)]">تعليم يُرى، ومسار يُفهم.</p></div></aside>;
}
