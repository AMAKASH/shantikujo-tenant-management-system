import { FormSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen>
      <PageHeaderSkeleton back actions={0} />
      <FormSkeleton />
    </LoadingScreen>
  );
}
