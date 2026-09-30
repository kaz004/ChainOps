import { MockRepositoryAnalyzer } from "@/server/adapters/simulated/repository-analyzer";
import type { AnalyzeRepositoryInput, RepositoryAnalysis, RepositoryAnalyzer } from "@/server/core/ports/repository-analyzer";
import { aiAnalysisSchema, deploymentRiskSchema, postmortemSchema, type AIAnalysis, type AIProvider, type DeploymentRisk, type DeploymentRiskContext, type DemoPostmortem, type IncidentAIContext } from "@/server/core/ports/ai-provider";

export class MockAIProvider implements AIProvider {
  readonly name = "Deterministic demo AI";
  readonly isDemo = true;
  constructor(private readonly repositoryAnalyzer: RepositoryAnalyzer = new MockRepositoryAnalyzer()) {}

  analyze(input: AnalyzeRepositoryInput): RepositoryAnalysis { return this.repositoryAnalyzer.analyze(input); }
  strengthsFor(input: AnalyzeRepositoryInput): string[] { return this.repositoryAnalyzer.strengthsFor(input); }

  analyzeIncident(context: IncidentAIContext): AIAnalysis {
    const evidence = this.evidenceFor(context);
    const insufficient = evidence.length === 0;
    const mentionsRpc = `${context.incident.title} ${context.incident.summary} ${context.events.map((event) => event.message).join(" ")}`.toLowerCase().includes("rpc");
    const rpcDegraded = mentionsRpc && context.chains.some((chain) => chain.status === "degraded" && chain.providers.some((provider) => provider.status === "degraded" || provider.status === "down"));
    const latestFailure = context.deployments.find((deployment) => ["failed", "rolled_back"].includes(deployment.status));
    const likelyCause = insufficient
      ? "Insufficient telemetry evidence to isolate a likely cause."
      : rpcDegraded
        ? "Degraded RPC provider is the strongest supported cause."
        : latestFailure
          ? `Recent deployment ${latestFailure.businessId} is a plausible contributor.`
          : "Available evidence indicates a service-level reliability regression; no single cause is confirmed.";
    return aiAnalysisSchema.parse({
      status: insufficient ? "insufficient-evidence" : "complete",
      summary: `${context.incident.title}: ${context.incident.summary}`,
      likelyCause,
      evidence,
      confidence: insufficient ? 0.1 : Math.min(0.9, 0.35 + evidence.length * 0.04),
      recommendedActions: insufficient
        ? ["Collect service metrics, logs, and traces before selecting a response."]
        : ["Compare affected-service telemetry with the last known healthy interval.", "Review linked deployments and RPC provider health before approving a change."],
      source: "demo-ai",
    });
  }

  assessDeployment(context: DeploymentRiskContext): DeploymentRisk {
    const evidence = [
      ...context.slos.filter((slo) => slo.status !== "healthy").map((slo) => ({ source: "slo" as const, id: slo.businessId, detail: `${slo.status}; remaining budget ${slo.budget.remainingPct.toFixed(1)}%, 1h burn ${slo.budget.burnRate1h}×.` })),
      ...context.openIncidents.map((incident) => ({ source: "incident-event" as const, id: incident.businessId, detail: `Open ${incident.severity} incident affects ${incident.title}.` })),
      ...context.recentFailures.map((deployment) => ({ source: "deployment" as const, id: deployment.businessId, detail: `Recent ${deployment.status} deployment of ${deployment.serviceName}.` })),
    ].slice(0, 20);
    const score = Math.min(100, evidence.reduce((total, item) => total + (item.source === "slo" ? 40 : item.source === "incident-event" ? 35 : 20), 10));
    return deploymentRiskSchema.parse({
      risk: score >= 70 ? "high" : score >= 35 ? "moderate" : "low",
      score,
      summary: evidence.length ? `Risk estimate uses ${evidence.length} linked reliability signal(s); it is advisory and simulated.` : "No elevated reliability signals were found in the sampled context.",
      evidence,
      recommendedActions: evidence.length ? ["Review the linked SLO and incident evidence before promotion.", "Use the deployment policy result as the source of enforcement; this score does not block or execute changes."] : ["Continue with standard deployment review; the estimate is not a guarantee."],
      source: "demo-ai",
    });
  }

  summarizeIncident(context: IncidentAIContext): string {
    return `${context.incident.businessId} (${context.incident.severity}, ${context.incident.status}) affects ${context.incident.serviceIds.length} service(s). ${context.events.length} timeline event(s), ${context.logs.length} sampled log(s), and ${context.traces.length} trace(s) are linked.`;
  }

  generatePostmortem(context: IncidentAIContext): DemoPostmortem {
    const analysis = this.analyzeIncident(context);
    return postmortemSchema.parse({
      title: `Postmortem: ${context.incident.title}`,
      impact: context.incident.impact,
      rootCause: analysis.likelyCause,
      detection: context.events.find((event) => event.kind === "detection")?.message ?? "Detection evidence was not available in the incident timeline.",
      response: context.events.filter((event) => ["mitigation", "action", "status-change"].includes(event.kind)).map((event) => event.message).slice(0, 12),
      lessons: analysis.evidence.length ? ["Preserve the telemetry and deployment evidence linked to this incident.", "Validate recovery against the affected service objective."] : ["Improve telemetry coverage before drawing conclusions."],
      evidence: analysis.evidence,
      source: "demo-ai",
    });
  }

  private evidenceFor(context: IncidentAIContext) {
    const fromEvents = context.events.slice(0, 5).map((event) => ({ source: "incident-event" as const, id: event.id, detail: event.message.slice(0, 400) }));
    const fromMetrics = context.metrics.flatMap((metric) => {
      const point = metric.points.at(-1);
      return point ? [{ source: "metric" as const, id: `${metric.serviceId}:${metric.kind}`, detail: `${metric.serviceName} ${metric.kind} ${point.v} ${metric.unit}.` }] : [];
    }).slice(0, 5);
    const fromLogs = context.logs.slice(0, 4).map((log) => ({ source: "log" as const, id: log.id, detail: `${log.level}: ${log.message}` }));
    const fromTraces = context.traces.slice(0, 3).map((trace) => ({ source: "trace" as const, id: trace.traceId, detail: `${trace.serviceName} trace ${trace.status}, ${trace.durationMs} ms.` }));
    const fromSlos = context.slos.slice(0, 4).map((slo) => ({ source: "slo" as const, id: slo.businessId, detail: `${slo.status}; SLI ${slo.sli.observedPct ?? "unavailable"}% vs ${slo.targetPct}%.` }));
    const fromDeployments = context.deployments.slice(0, 3).map((deployment) => ({ source: "deployment" as const, id: deployment.businessId, detail: `${deployment.serviceName} ${deployment.version} ${deployment.status}.` }));
    const fromPipelines = context.pipelines.slice(0, 3).map((run) => ({ source: "pipeline" as const, id: run.businessId, detail: `${run.serviceName} ${run.version} pipeline ${run.status}.` }));
    const fromChains = context.chains.filter((chain) => chain.status !== "healthy").slice(0, 3).map((chain) => ({ source: "chain" as const, id: chain.businessId, detail: `${chain.network} chain ${chain.status}; ${chain.providers.filter((provider) => provider.status !== "healthy").length} provider(s) degraded.` }));
    return [...fromEvents, ...fromMetrics, ...fromLogs, ...fromTraces, ...fromSlos, ...fromDeployments, ...fromPipelines, ...fromChains].slice(0, 20);
  }
}
