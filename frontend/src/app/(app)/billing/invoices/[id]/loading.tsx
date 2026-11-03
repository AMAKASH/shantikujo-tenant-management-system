import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <LoadingScreen label="Loading invoice">
      <div className="max-w-3xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-36 rounded-xl" />
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </div>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between bg-primary px-5 py-6 sm:px-7">
            <div className="h-6 w-48 animate-pulse rounded-md bg-white/20" />
            <div className="h-7 w-36 animate-pulse rounded-md bg-white/20" />
          </div>
          <div className="grid gap-4 border-b border-line px-5 py-5 sm:grid-cols-3 sm:px-7">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between px-5 py-3.5 sm:px-7">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="flex flex-col items-end gap-2 border-t-2 border-line px-5 py-5 sm:px-7">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-40" />
          </div>
        </Card>
      </div>
    </LoadingScreen>
  );
}
