import { z } from "zod";
import type { Chain, Deployment, ErrorBudget, Incident, IncidentEvent, LogEntry, PipelineRun, RpcProvider, Slo, TelemetryMetric, Trace } from "@/types/domain";
import type { SliObservation } from "@/server/core/domain/slo";
import type { RepositoryAnalyzer } from "@/server/core/ports/repository-analyzer";

export const aiEvidenceSchema = z.object({
  source: z.enum(["incident-event", "metric", "log", "trace", "slo", "deployment", "pipeline", "chain"]),
  id: z.string().min(1),
  detail: z.string().min(1).max(400),
});

export const aiAnalysisSchema = z.object({
  status: z.enum(["complete", "insufficient-evidence", "failed"]),
  summary: z.string().min(1).max(500),
  likelyCause: z.string().min(1).max(300),
  evidence: z.array(aiEvidenceSchema).max(20),
  confidence: z.number().min(0).max(1),
  recommendedActions: z.array(z.string().min(1).max(240)).max(6),
  source: z.literal("demo-ai"),
});
export type AIAnalysis = z.infer<typeof aiAnalysisSchema>;

export interface AISloContext extends Slo {
  budget: ErrorBudget;
  status: "healthy" | "at-risk" | "breached";
  sli: SliObservation;
}

export interface AIChainContext extends Chain {
  providers: RpcProvider[];
}

export interface IncidentAIContext {
  incident: Incident;
  events: IncidentEvent[];
  metrics: TelemetryMetric[];
  logs: LogEntry[];
  traces: Trace[];
  slos: AISloContext[];
  deployments: Deployment[];
  pipelines: PipelineRun[];
  chains: AIChainContext[];
}

export interface DeploymentRiskContext {
  deployment: Deployment;
  slos: AISloContext[];
  openIncidents: Incident[];
  recentFailures: Deployment[];
}

export const deploymentRiskSchema = z.object({
  risk: z.enum(["low", "moderate", "high"]),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(500),
  evidence: z.array(aiEvidenceSchema).max(20),
  recommendedActions: z.array(z.string().min(1).max(240)).max(6),
  source: z.literal("demo-ai"),
});
export type DeploymentRisk = z.infer<typeof deploymentRiskSchema>;

export const postmortemSchema = z.object({
  title: z.string().min(1).max(180),
  impact: z.string().min(1).max(500),
  rootCause: z.string().min(1).max(500),
  detection: z.string().min(1).max(400),
  response: z.array(z.string().min(1).max(300)).max(12),
  lessons: z.array(z.string().min(1).max(300)).max(8),
  evidence: z.array(aiEvidenceSchema).max(20),
  source: z.literal("demo-ai"),
});
export type DemoPostmortem = z.infer<typeof postmortemSchema>;

export interface AIProvider extends RepositoryAnalyzer {
  analyzeIncident(context: IncidentAIContext): AIAnalysis;
  assessDeployment(context: DeploymentRiskContext): DeploymentRisk;
  summarizeIncident(context: IncidentAIContext): string;
  generatePostmortem(context: IncidentAIContext): DemoPostmortem;
}
