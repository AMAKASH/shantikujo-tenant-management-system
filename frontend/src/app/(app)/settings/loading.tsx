import { FormSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Loading settings">
      <PageHeaderSkeleton actions={0} />
      <FormSkeleton sections={3} />
    </LoadingScreen>
  );
}
