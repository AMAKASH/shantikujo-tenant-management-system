import { DetailCardSkeleton, ListSkeleton, LoadingScreen, PageHeaderSkeleton, StatGridSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading tenant">
      <PageHeaderSkeleton back actions={2} />
      <StatGridSkeleton count={3} />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <DetailCardSkeleton rows={4} />
          <ListSkeleton rows={4} />
        </div>
        <div className="flex flex-col gap-4">
          <DetailCardSkeleton rows={5} />
          <DetailCardSkeleton rows={3} />
        </div>
      </div>
    </LoadingScreen>
  );
}
