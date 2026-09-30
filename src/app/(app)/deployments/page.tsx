import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { DeploymentCenter } from "@/features/deployments/deployment-center";
import { getContainer } from "@/server/container";

export const metadata: Metadata = { title: "Deployments" };
export const dynamic = "force-dynamic";

export default function DeploymentsPage() {
  const container = getContainer();
  const initial = container.deploymentService.list({ page: 1, pageSize: 50 }).items;
  const options = container.deploymentService.creationOptions().projects;
  return <div className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-6">
    <PageHeader title="Deployments" description="Simulated release progression, deployment history, and rollback controls." />
    <DeploymentCenter initial={initial} projects={options} />
  </div>;
}
