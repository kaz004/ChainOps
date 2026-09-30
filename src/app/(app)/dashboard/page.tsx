import type { Metadata } from "next";
import { getContainer } from "@/server/container";
import { SummaryTiles, type TileTone } from "@/features/dashboard/summary-tiles";
import { ServiceHealthTable } from "@/features/dashboard/service-health-table";
import { SideRail } from "@/features/dashboard/side-rail";
import { RecentDeployments, ActivityTimeline } from "@/features/dashboard/activity-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const data = getContainer().dashboardService.getDashboard();

  const healthyAll = data.summary.servicesHealthy === data.summary.servicesTotal;
  const chainsAll = data.summary.chainsHealthy === data.summary.chainsTotal;

  const tiles: { label: string; value: string; sub: string; tone: TileTone }[] = [
    {
      label: "Services",
      value: `${data.summary.servicesHealthy} / ${data.summary.servicesTotal}`,
      sub: "healthy",
      tone: healthyAll ? "success" : "warning",
    },
    { label: "Deployments", value: String(data.summary.deploymentsActive), sub: "active", tone: "info" },
    {
      label: "Incidents",
      value: String(data.summary.incidentsOpen),
      sub: "open",
      tone: data.summary.incidentsOpen > 0 ? "warning" : "success",
    },
    {
      label: "SLO compliance",
      value: `${data.summary.sloCompliancePct.toFixed(2)}%`,
      sub: "30-day",
      tone: data.summary.sloCompliancePct >= 99.9 ? "success" : "warning",
    },
    {
      label: "Error budget",
      value: `${data.summary.errorBudgetPct}%`,
      sub: "remaining",
      tone: data.summary.errorBudgetPct > 50 ? "success" : data.summary.errorBudgetPct > 25 ? "warning" : "error",
    },
    {
      label: "Chains",
      value: `${data.summary.chainsHealthy} / ${data.summary.chainsTotal}`,
      sub: "healthy",
      tone: chainsAll ? "success" : "warning",
    },
  ];

  const healthLine =
    data.summary.incidentsOpen === 0
      ? "Production is healthy"
      : `Production is degraded — ${data.summary.incidentsOpen} incident${data.summary.incidentsOpen > 1 ? "s" : ""} investigating`;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{data.greeting.line1}</h1>
          <p className="text-sm text-muted-foreground">{healthLine}</p>
        </div>
        <p className="text-right text-[11px] text-muted-foreground">
          <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full bg-info" />
          Demo / Simulation environment
        </p>
      </div>

      <SummaryTiles tiles={tiles} />

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Service health</CardTitle>
            <span className="text-[11px] text-muted-foreground">RED + utilization</span>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <ServiceHealthTable services={data.services} />
          </CardContent>
        </Card>

        <SideRail chainStatus={data.chainStatus} incidents={data.incidents} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <RecentDeployments deployments={data.deployments} />
        <ActivityTimeline events={data.activity} />
      </div>
    </div>
  );
}
