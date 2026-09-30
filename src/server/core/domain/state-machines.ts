import type { DeploymentStatus, IncidentStatus, PipelineStatus } from "@/types/domain";

/** Canonical pipeline steps for a deployment (used by seed + creation). */
export const DEPLOYMENT_STEPS: readonly string[] = [
  "Source validated",
  "Tests passed",
  "Security scan",
  "Image built",
  "Image pushed",
  "Infrastructure validated",
  "Canary started",
  "Health checks",
  "Traffic shifted",
  "Deployment completed",
];

/**
 * Explicit state machines (docs/02 §3). Pure, table-driven; impossible
 * transitions are unrepresentable at the service layer.
 */

export type TransitionResult<S extends string> =
  | { ok: true; next: S }
  | { ok: false; reason: string };

// ── Deployment ────────────────────────────────────────────────────

export const DEPLOYMENT_STATUS_VALUES = [
  "queued",
  "running",
  "canary",
  "verifying",
  "success",
  "failed",
  "rollback_pending",
  "rolling_back",
  "rolled_back",
  "cancelled",
] as const;

export const DEPLOYMENT_TRANSITIONS: Readonly<Record<DeploymentStatus, readonly DeploymentStatus[]>> = {
  queued: ["running", "cancelled"],
  running: ["canary", "verifying", "failed", "cancelled"],
  canary: ["verifying", "failed", "cancelled"],
  verifying: ["success", "failed"],
  success: [],
  failed: ["rollback_pending"],
  rollback_pending: ["rolling_back", "rolled_back"],
  rolling_back: ["rolled_back", "failed"],
  rolled_back: [],
  cancelled: [],
};

export function canTransitionDeployment(from: DeploymentStatus, to: DeploymentStatus): boolean {
  return DEPLOYMENT_TRANSITIONS[from].includes(to);
}

export function transitionDeployment(
  from: DeploymentStatus,
  to: DeploymentStatus,
): TransitionResult<DeploymentStatus> {
  if (canTransitionDeployment(from, to)) return { ok: true, next: to };
  return { ok: false, reason: `Deployment cannot transition ${from} → ${to}` };
}

/** True when the deployment is still making progress (or rollback). */
export function isDeploymentActive(status: DeploymentStatus): boolean {
  return (
    status === "queued" ||
    status === "running" ||
    status === "canary" ||
    status === "verifying" ||
    status === "rollback_pending" ||
    status === "rolling_back"
  );
}

export const PIPELINE_STAGE_NAMES = [
  "Source", "Lint", "Unit tests", "Integration tests", "Contract tests", "Security scan",
  "Build", "Staging", "Smoke tests", "Canary", "Production",
] as const;

export const PIPELINE_TRANSITIONS: Readonly<Record<PipelineStatus, readonly PipelineStatus[]>> = {
  queued: ["running", "cancelled"],
  running: ["success", "failed", "cancelled"],
  success: [],
  failed: ["running"],
  cancelled: ["running"],
};

export function canTransitionPipeline(from: PipelineStatus, to: PipelineStatus): boolean {
  return PIPELINE_TRANSITIONS[from].includes(to);
}

export type PipelineStageState = "pending" | "running" | "success" | "failed" | "skipped" | "cancelled";
export const PIPELINE_STAGE_TRANSITIONS: Readonly<Record<PipelineStageState, readonly PipelineStageState[]>> = {
  pending: ["running", "skipped", "cancelled"],
  running: ["success", "failed", "cancelled"],
  success: [],
  failed: ["running"],
  skipped: [],
  cancelled: [],
};

export function canTransitionPipelineStage(from: PipelineStageState, to: PipelineStageState): boolean {
  return PIPELINE_STAGE_TRANSITIONS[from].includes(to);
}

// ── Incident ──────────────────────────────────────────────────────

export const INCIDENT_TRANSITIONS: Readonly<Record<IncidentStatus, readonly IncidentStatus[]>> = {
  detected: ["investigating", "resolved"],
  investigating: ["mitigating", "monitoring", "resolved"],
  mitigating: ["monitoring", "investigating", "resolved"],
  monitoring: ["investigating", "resolved"],
  resolved: [],
};

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return INCIDENT_TRANSITIONS[from].includes(to);
}

export function transitionIncident(
  from: IncidentStatus,
  to: IncidentStatus,
): TransitionResult<IncidentStatus> {
  if (canTransitionIncident(from, to)) return { ok: true, next: to };
  return { ok: false, reason: `Incident cannot transition ${from} → ${to}` };
}

export function isIncidentActive(status: IncidentStatus): boolean {
  return status !== "resolved";
}

export type ChaosRunState = "running" | "completed" | "aborted" | "failed";
export const CHAOS_RUN_TRANSITIONS: Readonly<Record<ChaosRunState, readonly ChaosRunState[]>> = {
  running: ["completed", "aborted", "failed"],
  completed: [],
  aborted: [],
  failed: [],
};

export function canTransitionChaosRun(from: ChaosRunState, to: ChaosRunState): boolean {
  return CHAOS_RUN_TRANSITIONS[from].includes(to);
}

export type RemediationState = "proposed" | "approved" | "rejected" | "executing" | "succeeded" | "failed";
export const REMEDIATION_TRANSITIONS: Readonly<Record<RemediationState, readonly RemediationState[]>> = {
  proposed: ["approved", "rejected"],
  approved: ["executing", "rejected"],
  rejected: [],
  executing: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
};

export function canTransitionRemediation(from: RemediationState, to: RemediationState): boolean {
  return REMEDIATION_TRANSITIONS[from].includes(to);
}
