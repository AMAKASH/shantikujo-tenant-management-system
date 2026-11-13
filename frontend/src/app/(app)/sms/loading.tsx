import { ListSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading SMS">
      <PageHeaderSkeleton />
      <div className="grid gap-4 xl:grid-cols-5">
        <ListSkeleton rows={6} className="xl:col-span-3" />
        <ListSkeleton rows={5} className="xl:col-span-2" />
      </div>
    </LoadingScreen>
  );
}
