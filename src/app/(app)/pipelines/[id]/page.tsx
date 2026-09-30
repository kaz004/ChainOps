import type { Metadata } from "next";
import { NotFoundCard } from "@/components/feedback/not-found-card";
import { PipelineDetail } from "@/features/pipelines/pipeline-detail";
import { getContainer } from "@/server/container";

interface PageProps { params: Promise<{ id: string }> }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return { title: `Pipeline ${(await params).id.toUpperCase()}` };
}

export default async function PipelineDetailPage({ params }: PageProps) {
  const { id } = await params;
  try {
    return <div className="mx-auto w-full max-w-[1100px] px-4 py-6 lg:px-6">
      <PipelineDetail initial={getContainer().pipelineService.get(id)} />
    </div>;
  } catch {
    return <NotFoundCard title={`Pipeline ${id.toUpperCase()} not found`} message="The pipeline run could not be found in this workspace." backHref="/pipelines" backLabel="Back to pipelines" />;
  }
}
