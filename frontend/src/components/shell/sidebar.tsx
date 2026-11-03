"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { activeHref, NAV } from "./nav";

export function Sidebar({ propertyName }: { propertyName: string }) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  return (
    <aside className="sticky top-0 hidden print:hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
      <div className="px-5 pt-6 pb-5">
        <Link href="/dashboard" aria-label="STMS home">
          <Logo />
        </Link>
      </div>
      <div className="mx-4 mb-4 rounded-xl bg-primary-light px-3 py-2.5">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Property</p>
        <p className="truncate text-sm font-bold text-primary">{propertyName}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Main">
        {NAV.map((item) => {
          const on = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors",
                on ? "bg-primary text-white shadow-sm" : "text-ink/80 hover:bg-primary-light hover:text-primary",
              )}
            >
              <item.icon className="size-[18px]" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="px-5 py-4 text-xs text-muted">STMS v1.0</p>
    </aside>
  );
}
