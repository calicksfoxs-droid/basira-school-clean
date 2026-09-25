import type { NavItem } from "./sidebar";

/** Only the most specific destination is current, including on nested pages. */
export function activeDestination(pathname: string, items: NavItem[]) {
  const match = items.filter(({ href, icon }) => pathname === href || (icon !== "home" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  if (match) return match;
  if (/\/subjects\/[^/]+\/journey/.test(pathname)) return items.find(item => item.icon === "journey")?.href;
  if (/\/(subjects|lessons|quizzes)(\/|$)/.test(pathname)) return items.find(item => item.icon === "school")?.href;
  return undefined;
}
