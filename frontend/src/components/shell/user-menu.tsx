"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-button";
import { Avatar } from "@/components/ui/misc";
import type { SessionUser } from "@/lib/types";

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-primary-light"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.name} size={34} />
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-bold text-ink">{user.name}</span>
          <span className="block text-xs leading-tight text-muted">Landlord</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted sm:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-primary-light">
            <Settings className="size-4" aria-hidden /> Settings
          </Link>
          <InstallAppButton className="w-full px-4 py-2.5 text-sm font-medium hover:bg-primary-light [&_svg]:size-4" onDone={() => setOpen(false)} />
          <button role="menuitem" type="button" onClick={logout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger-bg">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
