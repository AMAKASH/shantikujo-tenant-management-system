"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { installPrompt, type BeforeInstallPromptEvent } from "@/lib/pwa";

/**
 * Registers the service worker (production builds only), offers a reload when a new version is
 * ready, keeps the install prompt for the "Install app" buttons, and shows an offline banner.
 */
export function PwaProvider() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      installPrompt.set(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      installPrompt.set(null);
      toast.success("STMS installed");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // In development a service worker gets in the way of hot reload; opt in with NEXT_PUBLIC_SW_DEV=true.
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SW_DEV !== "true") return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const promptUpdate = (worker: ServiceWorker) =>
      toast("A new version of STMS is ready", {
        duration: Infinity,
        action: { label: "Reload", onClick: () => worker.postMessage("SKIP_WAITING") },
      });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            // Only prompt on updates; the very first install has no controller yet.
            if (sw.state === "installed" && navigator.serviceWorker.controller) promptUpdate(sw);
          });
        });
        // Check for updates when the app comes back to the foreground.
        const onVisible = () => document.visibilityState === "visible" && reg.update().catch(() => undefined);
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch((err) => console.warn("Service worker registration failed", err));

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning px-4 py-1.5 pt-[max(env(safe-area-inset-top),6px)] text-xs font-semibold text-white"
    >
      <WifiOff className="size-3.5" aria-hidden /> You&apos;re offline. Changes can&apos;t be saved until you reconnect.
    </div>
  );
}
