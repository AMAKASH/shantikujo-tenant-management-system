import { DetailCardSkeleton, ListSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading apartment">
      <PageHeaderSkeleton back actions={2} />
      <div className="grid gap-4 lg:grid-cols-3">
        <DetailCardSkeleton rows={6} />
        <div className="flex flex-col gap-4 lg:col-span-2">
          <DetailCardSkeleton rows={4} />
          <ListSkeleton rows={4} />
        </div>
      </div>
    </LoadingScreen>
  );
}
