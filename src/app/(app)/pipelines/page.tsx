import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PipelineCenter } from "@/features/pipelines/pipeline-center";
import { getContainer } from "@/server/container";

export const metadata: Metadata = { title: "Pipelines" };
export const dynamic = "force-dynamic";

export default function PipelinesPage() {
  const container = getContainer();
  return <div className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-6">
    <PageHeader title="Pipelines" description="Run deterministic validation stages and hand successful releases to the deployment simulator." />
    <PipelineCenter initial={container.pipelineService.list()} projects={container.deploymentService.creationOptions().projects} />
  </div>;
}
