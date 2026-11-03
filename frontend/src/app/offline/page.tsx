import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { RetryButton } from "./retry";

export const metadata: Metadata = { title: "Offline" };
export const dynamic = "force-static";

/** Shown by the service worker when a page can't be loaded. Static, so it never holds tenant data. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto mb-6 h-12 w-14" />
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-warning-bg text-warning">
          <WifiOff className="size-6" />
        </span>
        <h1 className="text-2xl font-extrabold text-primary">You&apos;re offline</h1>
        <p className="mt-2 text-muted">
          STMS needs an internet connection to show tenant and billing data. Check your connection and try again.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
