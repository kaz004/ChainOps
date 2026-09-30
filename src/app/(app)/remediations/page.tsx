import type { Metadata } from "next";
import { getContainer } from "@/server/container";
import { RemediationConsole } from "@/features/remediation/remediation-console";

export const metadata: Metadata = { title: "Policy & Remediation" };
export const dynamic = "force-dynamic";

export default function RemediationsPage() {
  const container = getContainer();
  const telemetry = container.telemetryService.getExplorer({ serviceId: undefined, severity: "all", q: "", page: 1, pageSize: 50, range: "1h" });
  const providers = container.chainService.list().flatMap((chain) => chain.providers.map((provider) => ({ id: provider.id, name: `${chain.network} · ${provider.name}`, status: provider.status })));
  const deployments = container.deploymentService.list({ page: 1, pageSize: 100 }).items.filter((deployment) => deployment.status === "failed").map((deployment) => ({ id: deployment.businessId, name: `${deployment.businessId} · ${deployment.serviceName} ${deployment.version}` }));
  return <main className="mx-auto w-full max-w-[1300px] px-4 py-6 lg:px-6"><header className="pb-5"><h1 className="text-lg font-semibold">Policy &amp; Remediation</h1><p className="text-sm text-muted-foreground">Allowlisted recovery proposals with approval, simulated execution, verification, and audit history</p></header><RemediationConsole actions={container.remediationService.list()} targets={{ services: telemetry.services.map((service) => ({ id: service.id, name: service.name })), providers, deployments }} /></main>;
}
