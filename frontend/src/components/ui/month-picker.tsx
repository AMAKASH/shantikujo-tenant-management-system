import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { periodLabel, shiftPeriod } from "@/lib/utils";

/** Previous / next month switcher driven by ?period=. */
export function MonthPicker({ period, href }: { period: string; href: (p: string) => string }) {
  const btn = "grid size-10 place-items-center rounded-xl text-primary hover:bg-primary-light";
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-white p-1 shadow-[var(--shadow-card)] ring-1 ring-line">
      <Link href={href(shiftPeriod(period, -1))} className={btn} aria-label="Previous month" scroll={false}>
        <ChevronLeft className="size-5" />
      </Link>
      <span className="min-w-36 text-center font-bold text-primary">{periodLabel(period, true)}</span>
      <Link href={href(shiftPeriod(period, 1))} className={btn} aria-label="Next month" scroll={false}>
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}
