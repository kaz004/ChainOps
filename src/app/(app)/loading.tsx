import { DashboardSkeleton } from "@/components/feedback/page-skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
      <DashboardSkeleton />
    </div>
  );
}
