import type {
  ActivityEvent,
  Deployment,
  HealthStatus,
  ServiceHealthSnapshot,
} from "@/types/domain";
import { getRepos } from "@/server/repositories/store";
import { getSimulationEngine } from "@/server/core/simulation/singleton";
import { computeErrorBudget } from "@/server/core/domain/slo";
import { chainTouchingServiceIds } from "@/server/seed/demo-data";
import { isDeploymentActive } from "@/server/core/domain/state-machines";

export interface DashboardSummary {
  servicesTotal: number;
  servicesHealthy: number;
  deploymentsActive: number;
  incidentsOpen: number;
  sloCompliancePct: number;
  errorBudgetPct: number;
  chainsTotal: number;
  chainsHealthy: number;
}

export interface IncidentSummaryRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  detectedAt: string;
  serviceNames: string[];
}

export interface ChainStatusRow {
  network: string;
  status: HealthStatus;
}

export interface DashboardData {
  greeting: { line1: string; healthLine: string; updatedAt: string; mode: "simulation" };
  summary: DashboardSummary;
  services: ServiceHealthSnapshot[];
  deployments: Deployment[];
  chainStatus: ChainStatusRow[];
  activity: ActivityEvent[];
  incidents: IncidentSummaryRow[];
}

function partOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getUTCHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

interface SloBudgetView {
  targetPct: number;
  budget: { remainingPct: number };
}

export class DashboardService {
  /** Injected so the dashboard reuses SLO evaluation instead of duplicating it. */
  constructor(
    private readonly getSlos: () => SloBudgetView[],
    private readonly getDeployments: () => Deployment[] = () => getRepos().deployments.all(),
  ) {}

  getDashboard(): DashboardData {
    const repos = getRepos();
    const engine = getSimulationEngine();

    // Services in the blast radius of open incidents take the full impact;
    // other chain-touching services see only a mild correlation bump.
    const affectedServiceIds = new Set(
      repos.incidents
        .all()
        .filter((i) => i.status !== "resolved")
        .flatMap((i) => i.serviceIds),
    );

    const snapshots: ServiceHealthSnapshot[] = repos.services.all().map((s) =>
      engine.serviceSnapshot(s.id, s.name, s.projectId, {
        touchesChains: chainTouchingServiceIds.has(s.id),
        affectedByIncident: affectedServiceIds.has(s.id),
      }),
    );

    const deployments = [...this.getDeployments()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    const incidents = [...repos.incidents.all()].sort((a, b) =>
      b.detectedAt.localeCompare(a.detectedAt),
    );

    const openIncidents = incidents.filter((i) => i.status !== "resolved");

    const deploymentsActive = deployments.filter((deployment) => isDeploymentActive(deployment.status)).length;

    const chains = repos.chains.all();
    const chainsHealthy = chains.filter((c) => c.status === "healthy").length;

    const errorBudgetPct = Math.round(
      this.averageBudgetRemaining(snapshots, affectedServiceIds),
    );

    // 30-day compliance per SLO, derived from its error budget:
    // observed = target + remaining% × (100 − target). This is the inverse of
    // the budget formula, so the tile stays consistent with the SLO center.
    const allSlos = this.getSlos();
    const sloCompliancePct =
      allSlos.length === 0
        ? 100
        : allSlos.reduce(
            (sum, s) =>
              sum + (s.targetPct + (s.budget.remainingPct / 100) * (100 - s.targetPct)),
            0,
          ) / allSlos.length;

    const summary: DashboardSummary = {
      servicesTotal: snapshots.length,
      servicesHealthy: snapshots.filter((s) => s.status === "healthy").length,
      deploymentsActive,
      incidentsOpen: openIncidents.length,
      sloCompliancePct: Math.round(sloCompliancePct * 100) / 100,
      errorBudgetPct,
      chainsTotal: chains.length,
      chainsHealthy,
    };

    const chainStatus: ChainStatusRow[] = chains.map((c) => ({
      network: c.network,
      status: c.status,
    }));

    const incidentRows: IncidentSummaryRow[] = openIncidents.slice(0, 3).map((i) => ({
      id: i.businessId,
      title: i.title,
      severity: i.severity,
      status: i.status,
      detectedAt: i.detectedAt,
      serviceNames: i.serviceIds
        .map((sid) => repos.services.get(sid)?.name ?? sid)
        .filter((n) => Boolean(n)),
    }));

    return {
      greeting: {
        line1: `Good ${partOfDay()}`,
        healthLine:
          openIncidents.length > 0
            ? "Production is degraded — 1 incident investigating"
            : "Production is healthy",
        updatedAt: new Date().toISOString(),
        mode: "simulation",
      },
      summary,
      services: snapshots,
      deployments: deployments.slice(0, 5),
      chainStatus,
      activity: repos.activity.recent(8),
      incidents: incidentRows,
    };
  }

  private averageBudgetRemaining(
    snapshots: ServiceHealthSnapshot[],
    affectedServiceIds: Set<string>,
  ): number {
    const repos = getRepos();
    if (snapshots.length === 0) return 100;

    const byId = new Map(snapshots.map((s) => [s.serviceId, s]));

    const values = repos.slos.all().map((slo) => {
      const snap = byId.get(slo.serviceId);
      if (!snap) return 100;
      const failingNow = affectedServiceIds.has(slo.serviceId);
      const observed = failingNow
        ? snap.availabilityPct
        : Math.max(snap.availabilityPct, slo.targetPct + 0.02);
      const recentErr = failingNow ? snap.errorRatePct : 0.12;
      const budget = computeErrorBudget(slo, observed, recentErr);
      return budget.remainingPct;
    });

    if (values.length === 0) return 100;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}
