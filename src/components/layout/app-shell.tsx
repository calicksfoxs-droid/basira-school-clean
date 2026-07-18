import { ClipboardCheck, GraduationCap, Home, Megaphone, School, Users } from "lucide-react";
import type { Identity } from "@/domain/models";
import { Sidebar, type NavIconName, type NavItem } from "./sidebar";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/utils";

function nav(identity: Identity): NavItem[] {
  if (identity.role === "admin") return [
    { href: "/app/admin", label: "الرئيسية", icon: "home" },
    { href: "/app/admin/teachers", label: "المعلمون", icon: "teachers" },
    { href: "/app/admin/students", label: "الطلاب", icon: "users" },
    { href: "/app/admin/groups", label: "المجموعات", icon: "school" },
    { href: "/app/admin/announcements", label: "الإعلانات", icon: "announcements" },
  ];
  if (identity.role === "teacher") return [
    { href: "/app/teacher", label: "الرئيسية", icon: "home" },
    { href: "/app/teacher/groups", label: "مجموعاتي", icon: "school" },
    { href: "/app/teacher/students", label: "طلابي", icon: "users" },
    { href: "/app/teacher/submissions", label: "التصحيح", icon: "grading" },
    { href: "/app/teacher/announcements", label: "الإعلانات", icon: "announcements" },
  ];
  return [
    { href: "/app/student", label: "الرئيسية", icon: "home" },
    { href: "/app/student/groups", label: "فصولي", icon: "school" },
    { href: "/app/student/results", label: "نتائجي", icon: "grading" },
  ];
}

const mobileIcons = {
  home: Home,
  teachers: GraduationCap,
  users: Users,
  school: School,
  announcements: Megaphone,
  grading: ClipboardCheck,
} satisfies Record<NavIconName, typeof Home>;

export function AppShell({ identity, children }: { identity: Identity; children: React.ReactNode }) {
  const items = nav(identity);
  return <div className="min-h-screen lg:flex"><Sidebar items={items}/><div className="min-w-0 flex-1"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-bold text-[#1479b8]">{roleLabel(identity.role)}</p><p className="font-black">{identity.displayName}</p></div><form action={logoutAction}><Button variant="secondary" size="sm">تسجيل الخروج</Button></form></div></header><div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden"><nav className="flex gap-2 overflow-x-auto">{items.map((item) => <LinkMobile key={item.href} {...item}/>)}</nav></div><main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main></div></div>;
}

function LinkMobile({ href, label, icon }: NavItem) { const Icon = mobileIcons[icon]; return <a href={href} className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-3 text-xs font-bold"><Icon className="size-4"/>{label}</a>; }
