import { LoadingScreen, ListSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen>
      <PageHeaderSkeleton />
      <ListSkeleton />
    </LoadingScreen>
  );
}
