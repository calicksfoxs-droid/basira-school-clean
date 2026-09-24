import type { NavItem } from "./sidebar";

/** Only the most specific destination is current, including on nested pages. */
export function activeDestination(pathname: string, items: NavItem[]) {
  return items.filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
