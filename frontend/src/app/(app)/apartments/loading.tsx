import { CardGridSkeleton, LoadingScreen, PageHeaderSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading apartments">
      <PageHeaderSkeleton />
      <TabsSkeleton />
      <div className="mt-4">
        <CardGridSkeleton />
      </div>
    </LoadingScreen>
  );
}
