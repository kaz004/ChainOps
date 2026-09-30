/**
 * ChainOps AI — domain model (Phase 3 subset).
 * Source of truth for entity shapes and status enums.
 * Conventions: business IDs (DEP-1042) + internal uuid; ISO-8601 UTC timestamps.
 */

import type { RepositoryAnalysis } from "@/server/core/ports/repository-analyzer";

// ── Shared primitives ─────────────────────────────────────────────

export type Iso8601 = string;

export type HealthStatus = "healthy" | "degraded" | "critical" | "unknown";

export type Severity = "sev-1" | "sev-2" | "sev-3" | "sev-4";

export const ENVIRONMENTS = ["production", "staging", "development"] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

export const CHAIN_NETWORKS = ["ethereum", "polygon", "base", "arbitrum"] as const;
export type ChainNetwork = (typeof CHAIN_NETWORKS)[number];

// ── Workspace / User ──────────────────────────────────────────────

export type UserRole = "owner" | "admin" | "engineer" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarHue: number;
}

// ── Project ───────────────────────────────────────────────────────

export type ProjectStatus = "active" | "archived";

export interface Project {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description: string;
  /** Repository in 'owner/repo' form. */
  repoUrl: string;
  /** Primary git branch used for deployments. */
  defaultBranch: string;
  status: ProjectStatus;
  /** Primary runtime environment for this project. */
  environment: EnvironmentName;
  ownerName: string;
  serviceIds: string[];
  chainIds: string[];
  createdAt: Iso8601;
  updatedAt: Iso8601;
  /** Set when archived; null while active. */
  archivedAt: Iso8601 | null;
}

// ── Repository analysis job ──────────────────────────────────────

export type AnalysisJobStatus = "queued" | "running" | "complete" | "failed";

/** Analysis pipeline stages (simulated progression, spec §15). */
export type AnalysisStageName =
  | "Fetching repository metadata"
  | "Detecting languages and frameworks"
  | "Scanning infrastructure manifests"
  | "Running reliability checks"
  | "Evaluating security posture"
  | "Preparing recommendations";

export interface AnalysisJob {
  id: string;
  businessId: string;
  projectId: string;
  repoUrl: string;
  ref: string;
  status: AnalysisJobStatus;
  /** Index into ANALYSIS_STAGES for progress display. */
  stageIndex: number;
  queuedAt: Iso8601;
  startedAt: Iso8601 | null;
  finishedAt: Iso8601 | null;
  /** Populated when complete (validated by repositoryAnalysisSchema). */
  analysis: RepositoryAnalysis | null;
  error: string | null;
  /** Provenance of the result (mirrors analysis.source). */
  source: "demo-analysis" | "real-integration";
}

// ── Service ───────────────────────────────────────────────────────

export type ServiceKind = "api" | "worker" | "frontend" | "contract";
export type ServiceTier = "tier-1" | "tier-2" | "tier-3";

export interface Service {
  id: string;
  businessId: string;
  projectId: string;
  name: string;
  kind: ServiceKind;
  tier: ServiceTier;
  environment: EnvironmentName;
  teamName: string;
  createdAt: Iso8601;
}

// ── Deployment (state machine — see state-machines.ts) ────────────

export type DeploymentStatus =
  | "queued"
  | "running"
  | "canary"
  | "verifying"
  | "success"
  | "failed"
  | "rollback_pending"
  | "rolling_back"
  | "rolled_back"
  | "cancelled";

export type DeploymentTrigger = "manual" | "pipeline" | "auto-rollback";

export interface DeploymentStep {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  startedAt: Iso8601 | null;
  endedAt: Iso8601 | null;
}

export interface DeploymentLog {
  id: string;
  at: Iso8601;
  level: "info" | "warning" | "error";
  message: string;
}

export type PipelineStatus = "queued" | "running" | "success" | "failed" | "cancelled";
export type PipelineStageStatus = "pending" | "running" | "success" | "failed" | "skipped" | "cancelled";

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  startedAt: Iso8601 | null;
  endedAt: Iso8601 | null;
  log: string[];
}

export interface PipelineRun {
  id: string;
  businessId: string;
  projectId: string;
  serviceId: string;
  serviceName: string;
  version: string;
  gitSha: string;
  environment: EnvironmentName;
  status: PipelineStatus;
  stages: PipelineStage[];
  deploymentId: string | null;
  failureStage: string | null;
  startStageIndex: number;
  startedAt: Iso8601;
  completedAt: Iso8601 | null;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface CanaryWeights {
  stablePct: number;
  canaryPct: number;
}

export interface Deployment {
  id: string;
  businessId: string;
  projectId: string;
  serviceId: string;
  serviceName: string;
  version: string;
  gitSha: string;
  environment: EnvironmentName;
  trigger: DeploymentTrigger;
  status: DeploymentStatus;
  steps: DeploymentStep[];
  logs: DeploymentLog[];
  simulatedFailureStep: string | null;
  isSimulatedRun: boolean;
  canary: CanaryWeights | null;
  durationMs: number | null;
  triggeredByName: string;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

// ── Incident (state machine) ──────────────────────────────────────

export type IncidentStatus =
  | "detected"
  | "investigating"
  | "mitigating"
  | "monitoring"
  | "resolved";

export interface Incident {
  id: string;
  businessId: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  serviceIds: string[];
  affectedProjectIds: string[];
  detectedAt: Iso8601;
  resolvedAt: Iso8601 | null;
  summary: string;
  impact: string;
}

export type AlertStatus = "firing" | "resolved";

export interface Alert {
  id: string;
  businessId: string;
  title: string;
  severity: Severity;
  status: AlertStatus;
  source: "telemetry" | "slo";
  serviceId: string;
  sloId: string | null;
  incidentId: string | null;
  metric: string;
  observedValue: number;
  threshold: number;
  firstFiredAt: Iso8601;
  resolvedAt: Iso8601 | null;
}

export type IncidentEventKind =
  | "detection"
  | "alert"
  | "status-change"
  | "ai-analysis"
  | "action"
  | "mitigation"
  | "resolution";

export interface IncidentEvent {
  id: string;
  incidentId: string;
  at: Iso8601;
  kind: IncidentEventKind;
  message: string;
  actor: "system" | "ai" | string;
}

// ── SLO / Error budget ────────────────────────────────────────────

export type SloKind = "availability" | "latency" | "error-rate" | "success-rate";

export interface Slo {
  id: string;
  businessId: string;
  serviceId: string;
  serviceName: string;
  kind: SloKind;
  targetPct: number;
  windowDays: 30;
  description: string;
}

export interface ErrorBudget {
  sloId: string;
  targetPct: number;
  currentPct: number;
  remainingPct: number;
  consumedPct: number;
  burnRate1h: number;
  burnRate6h: number;
  projectedExhaustionAt: Iso8601 | null;
}

// ── Chains ────────────────────────────────────────────────────────

export type RpcProviderStatus = "healthy" | "degraded" | "down";

export interface Chain {
  id: string;
  businessId: string;
  network: ChainNetwork;
  chainId: number;
  blockHeight: number;
  blockTimeMs: number;
  status: HealthStatus;
}

export interface RpcProvider {
  id: string;
  chainId: string;
  name: string;
  trafficWeightPct: number;
  status: RpcProviderStatus;
  latencyP50Ms: number;
  latencyP95Ms: number;
  errorRatePct: number;
}

// ── Chaos (types only in Phase 1) ─────────────────────────────────

export const CHAOS_EXPERIMENT_TYPES = [
  "pod-failure", "rpc-failure", "network-latency", "packet-loss", "cpu-stress",
  "memory-pressure", "db-failure", "traffic-spike", "deployment-regression",
] as const;
export type ChaosExperimentType = (typeof CHAOS_EXPERIMENT_TYPES)[number];

export type ChaosRunStatus = "running" | "completed" | "aborted" | "failed";

export interface ChaosRun {
  id: string;
  businessId: string;
  type: ChaosExperimentType;
  targetServiceId: string;
  targetServiceName: string;
  durationSeconds: number;
  intensity: number;
  blastRadiusServiceIds: string[];
  expectedImpact: string;
  status: ChaosRunStatus;
  startedAt: Iso8601;
  endsAt: Iso8601;
  completedAt: Iso8601 | null;
  result: string | null;
  incidentId: string | null;
}

export const REMEDIATION_TYPES = ["service-restart", "rpc-failover", "provider-disable", "deployment-rollback"] as const;
export type RemediationType = (typeof REMEDIATION_TYPES)[number];
export type RemediationRisk = "low" | "moderate" | "high";
export type RemediationStatus = "proposed" | "approved" | "rejected" | "executing" | "succeeded" | "failed";

export interface RemediationAuditEvent {
  id: string;
  at: Iso8601;
  kind: "proposed" | "approved" | "rejected" | "execution-started" | "execution-succeeded" | "execution-failed";
  actor: string;
  detail: string;
}

export interface RemediationAction {
  id: string;
  businessId: string;
  type: RemediationType;
  targetId: string;
  targetName: string;
  risk: RemediationRisk;
  reason: string;
  policy: string;
  approvalRequired: boolean;
  status: RemediationStatus;
  requestedBy: string;
  approvedBy: string | null;
  createdAt: Iso8601;
  updatedAt: Iso8601;
  result: string | null;
  auditEvents: RemediationAuditEvent[];
}

// ── Activity / notifications ──────────────────────────────────────

export type ActivityKind =
  | "deployment"
  | "incident"
  | "slo"
  | "chain"
  | "chaos"
  | "project"
  | "system";

export interface ActivityEvent {
  id: string;
  at: Iso8601;
  kind: ActivityKind;
  title: string;
  detail: string;
  refType: "deployment" | "incident" | "slo" | "chain" | "project" | null;
  refId: string | null;
  actor: string;
}

export interface Notification {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  readAt: Iso8601 | null;
  createdAt: Iso8601;
}

// ── Telemetry (sim-generated) ─────────────────────────────────────

export interface MetricPoint {
  t: Iso8601;
  v: number;
}

export interface ServiceHealthSnapshot {
  serviceId: string;
  serviceName: string;
  projectId: string;
  status: HealthStatus;
  availabilityPct: number;
  requestRatePerMin: number;
  errorRatePct: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  cpuPct: number;
  memoryPct: number;
}

export type MetricKind = "request-rate" | "error-rate" | "latency-p95" | "cpu" | "memory";
export type LogLevel = "info" | "warn" | "error";

export interface TelemetryMetric {
  serviceId: string;
  serviceName: string;
  kind: MetricKind;
  unit: string;
  points: MetricPoint[];
}

export interface LogEntry {
  id: string;
  timestamp: Iso8601;
  level: LogLevel;
  serviceId: string;
  serviceName: string;
  traceId: string;
  spanId: string;
  message: string;
  attributes: Record<string, string>;
}

export interface TraceSpan {
  spanId: string;
  parentSpanId: string | null;
  serviceId: string;
  serviceName: string;
  operation: string;
  startTime: Iso8601;
  durationMs: number;
  status: "ok" | "error";
}

export interface Trace {
  traceId: string;
  serviceId: string;
  serviceName: string;
  projectId: string;
  startedAt: Iso8601;
  durationMs: number;
  status: "ok" | "error";
  spans: TraceSpan[];
}

// ── Workspace meta ────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  plan: "demo";
  mode: "simulation";
  seededAt: Iso8601;
}
