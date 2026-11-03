"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal } from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { logout } from "./user-menu";
import { activeHref, NAV } from "./nav";

export function BottomNav() {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const [more, setMore] = useState(false);
  const primary = NAV.filter((n) => n.mobile);
  const extra = NAV.filter((n) => !n.mobile);
  const moreActive = extra.some((n) => n.href === active);

  const item = (on: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11px] font-semibold transition-colors",
      on ? "text-primary" : "text-muted",
    );

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 pb-safe backdrop-blur lg:hidden"
      >
        {primary.map((n) => {
          const on = n.href === active;
          return (
            <Link key={n.href} href={n.href} className={item(on)} aria-current={on ? "page" : undefined}>
              <span className={cn("grid h-7 w-12 place-items-center rounded-full", on && "bg-primary-light")}>
                <n.icon className="size-5" aria-hidden />
              </span>
              {n.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className={item(moreActive)}>
          <span className={cn("grid h-7 w-12 place-items-center rounded-full", moreActive && "bg-primary-light")}>
            <MoreHorizontal className="size-5" aria-hidden />
          </span>
          More
        </button>
      </nav>

      <Dialog open={more} onClose={() => setMore(false)} title="More">
        <div className="flex flex-col gap-1">
          {extra.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMore(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-ink hover:bg-primary-light"
            >
              <n.icon className="size-5 text-primary" aria-hidden />
              {n.label}
            </Link>
          ))}
          <InstallAppButton className="rounded-xl px-3 py-3 text-ink hover:bg-primary-light" onDone={() => setMore(false)} />
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold text-danger hover:bg-danger-bg"
          >
            <LogOut className="size-5" aria-hidden />
            Sign out
          </button>
        </div>
      </Dialog>
    </>
  );
}
