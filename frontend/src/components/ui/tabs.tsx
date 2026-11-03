import Link from "next/link";
import { cn } from "@/lib/utils";

/** Link-based filter tabs (state lives in the URL so it survives refresh and SSR). */
export function FilterTabs({ items, active }: { items: { href: string; label: string; count?: number; value: string }[]; active: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-xl bg-white p-1 shadow-[var(--shadow-card)] ring-1 ring-line">
        {items.map((i) => (
          <Link
            key={i.value}
            href={i.href}
            scroll={false}
            aria-current={i.value === active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              i.value === active ? "bg-primary text-white" : "text-muted hover:text-primary",
            )}
          >
            {i.label}
            {i.count != null && (
              <span className={cn("rounded-full px-1.5 text-xs", i.value === active ? "bg-white/20" : "bg-gray-100")}>{i.count}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
