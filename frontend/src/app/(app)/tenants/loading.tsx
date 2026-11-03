import { ListSkeleton, LoadingScreen, PageHeaderSkeleton, Skeleton, TabsSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading tenants">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsSkeleton />
        <Skeleton className="h-11 w-full rounded-xl sm:w-72" />
      </div>
      <ListSkeleton rows={8} className="mt-4" />
    </LoadingScreen>
  );
}
