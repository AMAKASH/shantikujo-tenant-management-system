import { BarChart3, Building2, CreditCard, Gauge, Home, Settings, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, mobile: true },
  { href: "/tenants", label: "Tenants", icon: Users, mobile: true },
  { href: "/apartments", label: "Apartments", icon: Building2, mobile: true },
  { href: "/billing", label: "Billing", icon: CreditCard, mobile: true },
  { href: "/billing/meter-readings", label: "Meter readings", icon: Gauge },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** The most specific nav item matching the path wins (so /billing/meter-readings doesn't also light up /billing). */
export function activeHref(pathname: string) {
  return NAV.filter((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0]?.href;
}
