"use client";

import { useRef } from "react";
import { activeDestination } from "./nav-active";
import { ToastRegion } from "@/components/ui/toast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, BookOpen, ClipboardCheck, Compass, GraduationCap, Home, Megaphone, School, Settings, Users } from "lucide-react";
import type { Identity } from "@/domain/models";
import type { UserPreferences } from "@/domain/core-models";
import { Sidebar, type NavIconName, type NavItem } from "./sidebar";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/utils";

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
    { href: "/app/student/grades", label: "صفوفي", icon: "school", mobile: true },
    { href: "/app/student/journey", label: "رحلتي", icon: "journey", mobile: true },
    { href: "/app/student/results", label: "نتائجي", icon: "grading" },
    { href: "/app/settings/enrollment-reference", label: "حسابي", icon: "settings", mobile: true },
  ];
}

const icons = { home: Home, teachers: GraduationCap, users: Users, school: School, announcements: Megaphone, grading: ClipboardCheck, subjects: BookOpen, journey: Compass, settings: Settings } satisfies Record<NavIconName, typeof Home>;

export function AppShell({ identity, preferences, platformName, children }: { identity: Identity; preferences: UserPreferences; platformName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = nav(identity);
  const current = activeDestination(pathname, items);
  const menu = useRef<HTMLDialogElement>(null);
  const mobileItems = items.filter((item) => item.mobile).slice(0, 4);
  return <div className="app-shell min-h-screen lg:flex" data-role={identity.role} data-theme={preferences.theme} data-reduced-motion={preferences.reducedMotion ? "true" : "false"}>
    <a href="#main-content" className="skip-link">تجاوز التنقل</a>
    <Sidebar items={items} platformName={platformName} role={roleLabel(identity.role)}/>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:h-20 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1168px] items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="فتح قائمة التنقل" className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] lg:hidden" onClick={() => menu.current?.showModal()}><Menu className="size-5"/></button><div><p className="text-xs font-bold text-[var(--accent)]">{roleLabel(identity.role)}</p><p className="font-heading font-bold">{identity.displayName}</p></div></div><form action={logoutAction}><Button variant="secondary" size="sm">تسجيل الخروج</Button></form></div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1168px] p-4 pb-28 sm:p-6 sm:pb-28 lg:p-10 lg:pb-12"><div key={pathname} className="soft-enter">{children}</div></main>
    </div>
    <ToastRegion/>
    <dialog ref={menu} aria-label="كل وجهات التنقل" className="mobile-menu confirmation-dialog"><div className="mb-6 flex items-center justify-between"><strong className="font-heading text-xl">{platformName}</strong><button type="button" aria-label="إغلاق القائمة" className="focus-ring grid size-11 place-items-center rounded-xl" onClick={() => menu.current?.close()}><X/></button></div><nav className="grid gap-2">{items.map(item => { const Icon = icons[item.icon]; return <Link key={item.href} href={item.href} onClick={() => menu.current?.close()} aria-current={current === item.href ? "page" : undefined} className="nav-link focus-ring flex min-h-12 items-center gap-3 rounded-xl p-3"><Icon className="size-5"/>{item.label}</Link>; })}</nav></dialog>
    <nav aria-label="التنقل الرئيسي للهاتف" className="mobile-bottom-nav lg:hidden">
      {mobileItems.map((item) => { const Icon = icons[item.icon]; const active = current === item.href; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`mobile-bottom-link ${active ? "is-active" : ""}`}><Icon className="size-5"/><span>{item.label}</span></Link>; })}
    </nav>
  </div>;
}
