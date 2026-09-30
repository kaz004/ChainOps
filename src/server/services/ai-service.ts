import type { AIAnalysis, AIProvider, DemoPostmortem, DeploymentRisk, IncidentAIContext } from "@/server/core/ports/ai-provider";
import { aiAnalysisSchema } from "@/server/core/ports/ai-provider";
import type { DeploymentService } from "@/server/services/deployment-service";
import type { IncidentService } from "@/server/services/incident-service";
import type { SloService } from "@/server/services/slo-service";
import type { ChainService } from "@/server/services/chain-service";
import { getRepos } from "@/server/repositories/store";

export class AIService {
  constructor(
    private readonly incidents: IncidentService,
    private readonly deployments: DeploymentService,
    private readonly slos: SloService,
    private readonly chains: ChainService,
    private readonly provider: AIProvider,
  ) {}

  analyzeIncident(id: string): AIAnalysis {
    const context = this.incidentContext(id);
    try {
      return aiAnalysisSchema.parse(this.provider.analyzeIncident(context));
    } catch {
      return aiAnalysisSchema.parse({
        status: "failed", summary: "Demo analysis could not be completed.",
        likelyCause: "No conclusion available.", evidence: [], confidence: 0,
        recommendedActions: ["Review the incident's linked telemetry and timeline manually."], source: "demo-ai",
      });
    }
  }

  incidentBundle(id: string): { analysis: AIAnalysis; summary: string; postmortem: DemoPostmortem | null; source: "demo-ai" } {
    const context = this.incidentContext(id);
    const analysis = this.analyzeIncident(id);
    let summary = `${context.incident.businessId} ${context.incident.status}: ${context.incident.summary}`;
    let postmortem: DemoPostmortem | null = null;
    try {
      summary = this.provider.summarizeIncident(context);
      postmortem = this.provider.generatePostmortem(context);
    } catch {
      postmortem = null;
    }
    return { analysis, summary, postmortem, source: "demo-ai" };
  }

  assessDeployment(id: string): DeploymentRisk {
    const deployment = this.deployments.get(id);
    const repos = getRepos();
    const slos = this.slos.listWithBudgets().filter((slo) => slo.serviceId === deployment.serviceId);
    const openIncidents = repos.incidents.all().filter((incident) => incident.status !== "resolved" && incident.serviceIds.includes(deployment.serviceId));
    const recentFailures = this.deployments.list({ page: 1, pageSize: 100 }).items
      .filter((item) => item.serviceId === deployment.serviceId && ["failed", "rolled_back"].includes(item.status))
      .slice(0, 5);
    return this.provider.assessDeployment({ deployment, slos, openIncidents, recentFailures });
  }

  private incidentContext(id: string): IncidentAIContext {
    const detail = this.incidents.detail(id);
    const slos = this.slos.listWithBudgets().filter((slo) => detail.sloIds.includes(slo.id));
    return {
      incident: detail,
      events: detail.events,
      metrics: detail.telemetry.metrics,
      logs: detail.telemetry.logs,
      traces: detail.telemetry.traces,
      slos,
      deployments: detail.relatedDeployments,
      pipelines: detail.relatedPipelines,
      chains: this.chains.list(),
    };
  }
}
