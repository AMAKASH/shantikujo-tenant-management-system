import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A pulsing placeholder block. Size it with width/height classes. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden style={style} className={cn("animate-pulse rounded-md bg-line/70 motion-reduce:animate-none", className)} />;
}

/** Wraps a loading.tsx screen: announces loading to screen readers and hides the placeholders. */
export function LoadingScreen({ children, label = "Loading" }: { children: React.ReactNode; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({ back = false, actions = 1 }: { back?: boolean; actions?: number }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        {back && <Skeleton className="h-4 w-24" />}
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-36 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}

export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-20 rounded-full" />
      ))}
    </div>
  );
}

export function StatGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", count === 3 ? "grid-cols-3" : "xl:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/** A card holding a list of rows: avatar/tile, two text lines and a trailing value. */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <ul className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40 max-w-[70%]" />
              <Skeleton className="h-3 w-56 max-w-[90%]" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Grid of summary cards (apartments). */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardBody>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-14 rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-4 h-4 w-3/4" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className, bars = 12 }: { className?: string; bars?: number }) {
  // Fixed heights keep server and client markup identical.
  const heights = [45, 60, 52, 70, 64, 80, 58, 72, 66, 85, 76, 90];
  return (
    <Card className={className}>
      <CardBody className="flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex h-52 items-end gap-2">
          {Array.from({ length: bars }).map((_, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${heights[i % heights.length]}%` }} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/** Label/value pairs inside a card (detail pages). */
export function DetailCardSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <Card className={className}>
      <CardBody className="flex flex-col gap-4">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export function FormSkeleton({ sections = 2, fields = 4 }: { sections?: number; fields?: number }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {Array.from({ length: sections }).map((_, s) => (
        <Card key={s}>
          <CardBody className="flex flex-col gap-4">
            <Skeleton className="h-4 w-36" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
      <Skeleton className="h-12 w-40 rounded-xl" />
    </div>
  );
}
