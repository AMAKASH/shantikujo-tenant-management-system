"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible modal built on <dialog>. A bottom sheet on mobile, a centred card on larger screens. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-ink shadow-2xl backdrop:bg-primary/40 backdrop:backdrop-blur-[2px]",
        "sm:m-auto sm:max-w-lg sm:rounded-2xl",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-primary">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-muted hover:bg-gray-100 hover:text-ink"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 pb-safe">{children}</div>
        </div>
      )}
    </dialog>
  );
}
