"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/billing", label: "Invoices" },
  { href: "/billing/payments", label: "Payments" },
  { href: "/billing/meter-readings", label: "Meter readings" },
];

export function BillingTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Billing">
      {TABS.map((t) => {
        const on = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              on ? "border-accent text-primary" : "border-transparent text-muted hover:text-primary",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
