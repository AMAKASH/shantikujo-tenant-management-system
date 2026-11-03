import Link from "next/link";
import { Bell } from "lucide-react";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { UserMenu } from "@/components/shell/user-menu";
import { LogoMark } from "@/components/logo";
import { api } from "@/lib/api.server";
import type { SessionUser, Settings } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, settings] = await Promise.all([api<{ user: SessionUser }>("/auth/me"), api<Settings>("/settings")]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar propertyName={settings.propertyName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden" aria-label="STMS home">
            <LogoMark className="h-7 w-8" />
            <span className="text-lg font-extrabold text-primary">STMS</span>
          </Link>
          <p className="hidden truncate text-sm font-semibold text-muted lg:block">{settings.propertyName}</p>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/reports?tab=dues"
              className="grid size-10 place-items-center rounded-full text-ink hover:bg-primary-light"
              aria-label="Outstanding dues"
            >
              <Bell className="size-5" />
            </Link>
            <UserMenu user={user} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 sm:px-6 sm:pt-7 lg:pb-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
