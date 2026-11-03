import { ListSkeleton, LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading payments">
      <div className="mt-4 flex items-center justify-between gap-3">
        <Skeleton className="h-11 w-48 rounded-xl" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <ListSkeleton rows={8} className="mt-4" />
    </LoadingScreen>
  );
}
