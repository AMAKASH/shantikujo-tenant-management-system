"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { installPrompt, isIOS, isStandalone } from "@/lib/pwa";
import { cn } from "@/lib/utils";

/** "Install app": the native prompt on Android/desktop Chrome & Edge, or instructions on iPhone/iPad. */
export function InstallAppButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const deferred = useSyncExternalStore(installPrompt.subscribe, installPrompt.get, () => null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setIos(isIOS());
    setStandalone(isStandalone());
  }, []);

  if (standalone || (!deferred && !ios)) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      installPrompt.set(null);
      onDone?.();
    } else {
      setHelp(true);
    }
  }

  return (
    <>
      <button type="button" onClick={install} className={cn("flex items-center gap-3 text-left font-semibold", className)}>
        <Download className="size-5 text-primary" aria-hidden />
        Install app
      </button>
      <Dialog open={help} onClose={() => setHelp(false)} title="Install STMS" description="Add it to your Home Screen to open it like an app.">
        <ol className="flex flex-col gap-4 text-sm">
          <li className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-light text-primary"><Share className="size-4" /></span>
            <span>Tap the <strong>Share</strong> button in Safari&apos;s toolbar.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-light text-primary"><SquarePlus className="size-4" /></span>
            <span>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</span>
          </li>
        </ol>
      </Dialog>
    </>
  );
}
