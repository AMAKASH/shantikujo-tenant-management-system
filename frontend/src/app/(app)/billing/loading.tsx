import { ListSkeleton, LoadingScreen, Skeleton, StatGridSkeleton } from "@/components/ui/skeleton";
/** Shown below the Billing heading and tabs (the layout stays on screen). */
export default function Loading() {
  return (
    <LoadingScreen label="Loading billing">
      <div className="mt-4 flex items-center justify-between gap-3">
        <Skeleton className="h-11 w-48 rounded-xl" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <StatGridSkeleton count={3} className="mt-4" />
      <ListSkeleton rows={6} className="mt-4" />
    </LoadingScreen>
  );
}
