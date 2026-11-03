import { ChartSkeleton, ListSkeleton, LoadingScreen, PageHeaderSkeleton, StatGridSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading dashboard">
      <PageHeaderSkeleton actions={2} />
      <StatGridSkeleton />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" />
        <ChartSkeleton bars={5} />
      </div>
      <ListSkeleton rows={4} className="mt-4" />
    </LoadingScreen>
  );
}
