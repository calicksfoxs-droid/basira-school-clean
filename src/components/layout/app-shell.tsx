"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, ClipboardCheck, Compass, GraduationCap, Home, LogOut, Megaphone, School, Settings, Users } from "lucide-react";
import type { Identity } from "@/domain/models";
import type { UserPreferences } from "@/domain/core-models";
import { Sidebar, type NavIconName, type NavItem } from "./sidebar";
import { logoutAction } from "@/actions/auth";
import { roleLabel } from "@/lib/utils";
import { BasiraMark } from "@/components/brand/basira-mark";

function nav(identity: Identity): NavItem[] {
  if (identity.role === "admin") return [
    { href: "/app/admin", label: "الرئيسية", icon: "home", mobile: true },
    { href: "/app/admin/subjects", label: "المواد", icon: "subjects", mobile: true },
    { href: "/app/admin/teachers", label: "المعلمون", icon: "teachers" },
    { href: "/app/admin/students", label: "الطلاب", icon: "users", mobile: true },
    { href: "/app/admin/announcements", label: "الإعلانات", icon: "announcements" },
    { href: "/app/settings", label: "الإعدادات", icon: "settings", mobile: true },
  ];
  if (identity.role === "teacher") return [
    { href: "/app/teacher", label: "الرئيسية", icon: "home", mobile: true },
    { href: "/app/teacher/grades", label: "صفوفي", icon: "school", mobile: true },
    { href: "/app/teacher/students", label: "طلابي", icon: "users", mobile: true },
    { href: "/app/teacher/announcements", label: "الإعلانات", icon: "announcements" },
    { href: "/app/settings", label: "الإعدادات", icon: "settings", mobile: true },
  ];
  return [
    { href: "/app/student", label: "الرئيسية", icon: "home", mobile: true },
    { href: "/app/student/grades", label: "موادي", icon: "school", mobile: true },
    { href: "/app/student/journey", label: "مساري", icon: "journey", mobile: true },
    { href: "/app/student/results", label: "نتائجي", icon: "grading" },
    { href: "/app/settings/enrollment-reference", label: "حسابي", icon: "settings", mobile: true },
  ];
}

const icons = { home: Home, teachers: GraduationCap, users: Users, school: School, announcements: Megaphone, grading: ClipboardCheck, subjects: BookOpen, journey: Compass, settings: Settings } satisfies Record<NavIconName, typeof Home>;

export function AppShell({ identity, preferences, platformName, children }: { identity: Identity; preferences: UserPreferences; platformName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = nav(identity);
  const mobileItems = items.filter((item) => item.mobile).slice(0, 4);
  return <div className="app-shell min-h-screen lg:flex" data-theme={preferences.theme} data-reduced-motion={preferences.reducedMotion ? "true" : "false"}>
    <a href="#main-content" className="skip-link">تجاوز التنقل</a>
    <Sidebar items={items} platformName={platformName} role={roleLabel(identity.role)}/>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3 lg:hidden"><BasiraMark compact/><div className="min-w-0"><p className="truncate text-xs font-semibold text-[var(--brand)]">{roleLabel(identity.role)}</p><p className="truncate text-sm font-semibold">{identity.displayName}</p></div></div>
          <div className="hidden min-w-0 lg:block"><p className="text-[11px] font-semibold tracking-[.08em] text-[var(--muted)]">BASIRA / {roleLabel(identity.role)}</p><p className="mt-0.5 truncate text-sm font-semibold">{identity.displayName}</p></div>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="الإشعارات" className="focus-ring grid size-10 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]"><Bell className="size-[18px]"/></button>
            <form action={logoutAction}><button aria-label="تسجيل الخروج" className="focus-ring grid size-10 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--danger)]"><LogOut className="size-[18px]"/></button></form>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1280px] p-4 pb-24 sm:p-7 sm:pb-24 lg:p-10 lg:pb-12">{children}</main>
    </div>
    <nav aria-label="التنقل الرئيسي للهاتف" className="mobile-bottom-nav lg:hidden">
      {mobileItems.map((item) => { const Icon = icons[item.icon]; const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`mobile-bottom-link ${active ? "is-active" : ""}`}><Icon className="size-[18px]"/><span>{item.label}</span></Link>; })}
    </nav>
  </div>;
}
