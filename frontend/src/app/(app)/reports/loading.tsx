import { ChartSkeleton, ListSkeleton, LoadingScreen, PageHeaderSkeleton, StatGridSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading reports">
      <PageHeaderSkeleton />
      <TabsSkeleton count={3} />
      <StatGridSkeleton className="mt-4" />
      <ChartSkeleton className="mt-4" />
      <ListSkeleton rows={5} className="mt-4" />
    </LoadingScreen>
  );
}
