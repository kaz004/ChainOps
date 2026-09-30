import type { Metadata } from "next";
import { NotFoundCard } from "@/components/feedback/not-found-card";
import { PageHeader } from "@/components/layout/page-header";
import { DeploymentDetail } from "@/features/deployments/deployment-detail";
import { getContainer } from "@/server/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Deployment ${id.toUpperCase()}` };
}

export default async function DeploymentDetailPage({ params }: PageProps) {
  const { id } = await params;
  let deployment;
  try {
    deployment = getContainer().deploymentService.get(id);
  } catch {
    return <NotFoundCard title={`Deployment ${id.toUpperCase()} not found`} message="The deployment could not be found in this workspace." backHref="/deployments" backLabel="Back to deployments" />;
  }
  const risk = getContainer().aiService.assessDeployment(deployment.businessId);

  return <div className="mx-auto w-full max-w-[1100px] px-4 py-6 lg:px-6">
    <PageHeader breadcrumbs={[{ label: "Deployments", href: "/deployments" }, { label: deployment.businessId }]} title={`${deployment.serviceName} ${deployment.version}`} description={`${deployment.environment} · simulated release`} />
    <DeploymentDetail initial={deployment} />
    <Card className="mt-4"><CardHeader className="flex-row items-center justify-between"><CardTitle>Demo AI deployment risk</CardTitle><Badge variant={risk.risk === "high" ? "error" : risk.risk === "moderate" ? "warning" : "success"}>{risk.risk} · {risk.score}/100</Badge></CardHeader><CardContent><p className="text-sm">{risk.summary}</p><p className="mt-1 text-xs text-warning">Advisory simulated estimate; it does not approve, block, or execute this deployment.</p><ul className="mt-3 space-y-1">{risk.evidence.map((item) => <li key={`${item.source}-${item.id}`} className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{item.source} · {item.id}</span> — {item.detail}</li>)}</ul><ul className="mt-3 list-disc space-y-1 pl-4">{risk.recommendedActions.map((action) => <li key={action} className="text-xs text-muted-foreground">{action}</li>)}</ul></CardContent></Card>
  </div>;
}
