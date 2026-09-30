/**
 * Deterministic demo dataset (spec §64). All timestamps derive from a fixed
 * epoch so the demo is identical on every reset. No Math.random anywhere.
 */

import type {
  ActivityEvent,
  Alert,
  AnalysisJob,
  Chain,
  Deployment,
  Incident,
  IncidentEvent,
  Notification,
  Project,
  RpcProvider,
  Service,
  Slo,
  User,
  Workspace,
} from "@/types/domain";
import { resetCounters } from "@/server/core/domain/ids";
import { DEPLOYMENT_STEPS } from "@/server/core/domain/state-machines";

/** Fixed demo epoch: all relative times offset from this instant. */
const T0 = Date.parse("2026-09-30T12:00:00Z");
const min = (n: number) => new Date(T0 + n * 60_000).toISOString();

/**
 * Build deployment steps from the canonical pipeline. Optionally truncate to
 * the first `throughStepName` steps and mark one step failed (seed scenarios).
 */
function buildSteps(
  startMin: number,
  perStepSec: number,
  opts: { through?: string; failedStepIndex?: number } = {},
): Deployment["steps"] {
  let names = [...DEPLOYMENT_STEPS];
  if (opts.through) {
    const idx = DEPLOYMENT_STEPS.indexOf(opts.through);
    names = names.slice(0, idx + 1);
  }
  let cursor = startMin;
  return names.map((name, i) => {
    const s: Deployment["steps"][number] = {
      id: `st-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      status: "success",
      startedAt: min(cursor),
      endedAt: min(cursor + perStepSec / 60),
    };
    if (opts.failedStepIndex === i) s.status = "failed";
    cursor += perStepSec / 60;
    return s;
  });
}

// ── Users / workspace ─────────────────────────────────────────────

export const users: User[] = [
  { id: "usr-adrian", name: "Adrian Vale", email: "adrian@chainops.dev", role: "owner", avatarHue: 210 },
  { id: "usr-mira", name: "Mira Chen", email: "mira@chainops.dev", role: "engineer", avatarHue: 150 },
  { id: "usr-jonas", name: "Jonas Reyes", email: "jonas@chainops.dev", role: "engineer", avatarHue: 30 },
  { id: "usr-priya", name: "Priya Nair", email: "priya@chainops.dev", role: "admin", avatarHue: 280 },
];

export const workspace: Workspace = {
  id: "ws-1",
  name: "Acme Infrastructure",
  plan: "demo",
  mode: "simulation",
  seededAt: min(0),
};

// ── Projects ──────────────────────────────────────────────────────

export const projects: Project[] = [
  {
    id: "prj-goapass",
    businessId: "PRJ-1001",
    name: "GoaPass",
    slug: "goapass",
    description: "Transit payments platform for the Goa transit network — fare gates, top-ups and settlement.",
    repoUrl: "github.com/acme/goapass",
    defaultBranch: "main",
    status: "active",
    environment: "production",
    ownerName: "Adrian Vale",
    serviceIds: ["svc-api-gateway", "svc-checkout-api", "svc-payment-worker", "svc-notification-service"],
    chainIds: ["chn-base", "chn-polygon"],
    createdAt: min(-60 * 24 * 92),
    updatedAt: min(-12),
    archivedAt: null,
  },
  {
    id: "prj-ccp",
    businessId: "PRJ-1002",
    name: "CrossChain Payments",
    slug: "crosschain-payments",
    description: "Multichain settlement rails connecting stablecoin payments across four networks.",
    repoUrl: "github.com/acme/crosschain-payments",
    defaultBranch: "main",
    status: "active",
    environment: "production",
    ownerName: "Priya Nair",
    serviceIds: ["svc-rpc-router", "svc-payment-worker"],
    chainIds: ["chn-ethereum", "chn-polygon", "chn-base", "chn-arbitrum"],
    createdAt: min(-60 * 24 * 61),
    updatedAt: min(-47),
    archivedAt: null,
  },
  {
    id: "prj-inference",
    businessId: "PRJ-1003",
    name: "Inference Gateway",
    slug: "inference-gateway",
    description: "Routing gateway for on-chain model inference requests with per-request billing.",
    repoUrl: "github.com/acme/inference-gateway",
    defaultBranch: "main",
    status: "active",
    environment: "production",
    ownerName: "Jonas Reyes",
    serviceIds: ["svc-api-gateway"],
    chainIds: ["chn-base"],
    createdAt: min(-60 * 24 * 21),
    updatedAt: min(-60 * 26),
    archivedAt: null,
  },
];

// ── Services ──────────────────────────────────────────────────────

export const services: Service[] = [
  { id: "svc-api-gateway", businessId: "SVC-2001", projectId: "prj-goapass", name: "api-gateway", kind: "api", tier: "tier-1", environment: "production", teamName: "Platform", createdAt: min(-60 * 24 * 92) },
  { id: "svc-checkout-api", businessId: "SVC-2002", projectId: "prj-goapass", name: "checkout-api", kind: "api", tier: "tier-1", environment: "production", teamName: "Payments", createdAt: min(-60 * 24 * 92) },
  { id: "svc-payment-worker", businessId: "SVC-2003", projectId: "prj-goapass", name: "payment-worker", kind: "worker", tier: "tier-1", environment: "production", teamName: "Payments", createdAt: min(-60 * 24 * 90) },
  { id: "svc-notification-service", businessId: "SVC-2004", projectId: "prj-goapass", name: "notification-service", kind: "worker", tier: "tier-3", environment: "production", teamName: "Growth", createdAt: min(-60 * 24 * 80) },
  { id: "svc-rpc-router", businessId: "SVC-2005", projectId: "prj-ccp", name: "rpc-router", kind: "api", tier: "tier-1", environment: "production", teamName: "Platform", createdAt: min(-60 * 24 * 61) },
];

/** Services that depend on chain RPC availability (used by sim snapshots). */
export const chainTouchingServiceIds = new Set(["svc-api-gateway", "svc-checkout-api", "svc-payment-worker", "svc-rpc-router"]);

// ── Chains & RPC providers ────────────────────────────────────────

export const chains: Chain[] = [
  { id: "chn-ethereum", businessId: "CHN-3001", network: "ethereum", chainId: 1, blockHeight: 22_415_882, blockTimeMs: 12_000, status: "healthy" },
  { id: "chn-polygon", businessId: "CHN-3002", network: "polygon", chainId: 137, blockHeight: 71_002_914, blockTimeMs: 2_100, status: "healthy" },
  { id: "chn-base", businessId: "CHN-3003", network: "base", chainId: 8453, blockHeight: 29_887_140, blockTimeMs: 2_000, status: "degraded" },
  { id: "chn-arbitrum", businessId: "CHN-3004", network: "arbitrum", chainId: 42161, blockHeight: 331_608_442, blockTimeMs: 250, status: "healthy" },
];

export const rpcProviders: RpcProvider[] = [
  { id: "rpc-eth-a", chainId: "chn-ethereum", name: "Provider A", trafficWeightPct: 70, status: "healthy", latencyP50Ms: 74, latencyP95Ms: 180, errorRatePct: 0.11 },
  { id: "rpc-eth-b", chainId: "chn-ethereum", name: "Provider B", trafficWeightPct: 30, status: "healthy", latencyP50Ms: 92, latencyP95Ms: 210, errorRatePct: 0.19 },
  { id: "rpc-poly-a", chainId: "chn-polygon", name: "Provider A", trafficWeightPct: 60, status: "healthy", latencyP50Ms: 88, latencyP95Ms: 240, errorRatePct: 0.24 },
  { id: "rpc-poly-b", chainId: "chn-polygon", name: "Provider B", trafficWeightPct: 40, status: "healthy", latencyP50Ms: 104, latencyP95Ms: 260, errorRatePct: 0.31 },
  { id: "rpc-base-a", chainId: "chn-base", name: "Provider A", trafficWeightPct: 70, status: "healthy", latencyP50Ms: 96, latencyP95Ms: 220, errorRatePct: 0.18 },
  { id: "rpc-base-b", chainId: "chn-base", name: "Provider B", trafficWeightPct: 20, status: "degraded", latencyP50Ms: 4_820, latencyP95Ms: 11_400, errorRatePct: 11.4 },
  { id: "rpc-base-c", chainId: "chn-base", name: "Provider C", trafficWeightPct: 10, status: "healthy", latencyP50Ms: 118, latencyP95Ms: 310, errorRatePct: 0.42 },
  { id: "rpc-arb-a", chainId: "chn-arbitrum", name: "Provider A", trafficWeightPct: 100, status: "healthy", latencyP50Ms: 63, latencyP95Ms: 150, errorRatePct: 0.08 },
];

// ── Deployments ───────────────────────────────────────────────────

export const deployments: Deployment[] = [
  {
    id: "dep-1042", businessId: "DEP-1042", projectId: "prj-goapass", serviceId: "svc-checkout-api",
    serviceName: "checkout-api", version: "v1.4.2", gitSha: "8f29c1a4", environment: "production",
    trigger: "pipeline", status: "success",
    steps: buildSteps(-38, 42),
    logs: [], simulatedFailureStep: null,
    isSimulatedRun: false,
    canary: null, durationMs: 412_000, triggeredByName: "Mira Chen", createdAt: min(-38), updatedAt: min(-31),
  },
  {
    id: "dep-1041", businessId: "DEP-1041", projectId: "prj-ccp", serviceId: "svc-rpc-router",
    serviceName: "rpc-router", version: "v0.9.8", gitSha: "c41d77b9", environment: "production",
    trigger: "manual", status: "rolled_back",
    steps: buildSteps(-71, 55, { through: "Deployment completed" }),
    logs: [], simulatedFailureStep: null,
    isSimulatedRun: false,
    canary: null, durationMs: 388_000, triggeredByName: "Adrian Vale", createdAt: min(-71), updatedAt: min(-64),
  },
  {
    id: "dep-1040", businessId: "DEP-1040", projectId: "prj-inference", serviceId: "svc-api-gateway",
    serviceName: "api-gateway", version: "v2.1.0", gitSha: "de30b2c5", environment: "production",
    trigger: "pipeline", status: "canary",
    steps: buildSteps(-18, 40, { through: "Canary started" }),
    logs: [], simulatedFailureStep: null,
    isSimulatedRun: false,
    canary: { stablePct: 95, canaryPct: 5 }, durationMs: null, triggeredByName: "Jonas Reyes", createdAt: min(-18), updatedAt: min(-11),
  },
  {
    id: "dep-1039", businessId: "DEP-1039", projectId: "prj-goapass", serviceId: "svc-payment-worker",
    serviceName: "payment-worker", version: "v1.4.1", gitSha: "77aa0e12", environment: "production",
    trigger: "pipeline", status: "failed",
    steps: buildSteps(-140, 45, { through: "Image built", failedStepIndex: 3 }),
    logs: [], simulatedFailureStep: null,
    isSimulatedRun: false,
    canary: null, durationMs: 186_000, triggeredByName: "Pipeline (main)", createdAt: min(-140), updatedAt: min(-137),
  },
  {
    id: "dep-1038", businessId: "DEP-1038", projectId: "prj-ccp", serviceId: "svc-payment-worker",
    serviceName: "payment-worker", version: "v0.9.7", gitSha: "19cf8830", environment: "staging",
    trigger: "manual", status: "success",
    steps: buildSteps(-190, 36, { through: "Deployment completed" }),
    logs: [], simulatedFailureStep: null,
    isSimulatedRun: false,
    canary: null, durationMs: 249_000, triggeredByName: "Priya Nair", createdAt: min(-190), updatedAt: min(-184),
  },
];

// ── Incidents ─────────────────────────────────────────────────────

export const incidents: Incident[] = [
  {
    id: "inc-142", businessId: "INC-142", title: "Base RPC degradation",
    severity: "sev-2", status: "investigating",
    serviceIds: ["svc-rpc-router", "svc-checkout-api"], affectedProjectIds: ["prj-ccp", "prj-goapass"],
    detectedAt: min(-22), resolvedAt: null,
    summary: "Elevated latency and errors on Base RPC provider B.",
    impact: "Checkout and settlement requests via Base experience up to 11% failures.",
  },
  {
    id: "inc-141", businessId: "INC-141", title: "Payment queue backlog after deploy",
    severity: "sev-3", status: "resolved",
    serviceIds: ["svc-payment-worker"], affectedProjectIds: ["prj-goapass"],
    detectedAt: min(-60 * 26), resolvedAt: min(-60 * 25),
    summary: "Queue depth grew 14x after v1.4.1 introduced a slow DB query.",
    impact: "Payout processing delayed by up to 9 minutes. No funds affected.",
  },
];

export const alerts: Alert[] = [
  { id: "alt-142", businessId: "ALT-142", title: "Checkout availability below objective", severity: "sev-2", status: "firing", source: "slo", serviceId: "svc-checkout-api", sloId: "slo-4002", incidentId: "inc-142", metric: "availability", observedValue: 88.6, threshold: 99.95, firstFiredAt: min(-22), resolvedAt: null },
];

export const incidentEvents: IncidentEvent[] = [
  { id: "iev-1", incidentId: "inc-142", at: min(-22), kind: "detection", message: "RPC latency exceeded threshold (p95 > 2s on base provider-b)", actor: "system" },
  { id: "iev-2", incidentId: "inc-142", at: min(-21), kind: "alert", message: "Error-rate alert triggered: base provider-b errors at 11.4%", actor: "system" },
  { id: "iev-3", incidentId: "inc-142", at: min(-20), kind: "status-change", message: "Incident created, status set to investigating", actor: "system" },
  { id: "iev-4", incidentId: "inc-142", at: min(-16), kind: "ai-analysis", message: "AI analysis: likely RPC provider degradation (confidence high)", actor: "ai" },
  { id: "iev-5", incidentId: "inc-142", at: min(-15), kind: "action", message: "Traffic shifted away from provider-b (weight 20% → 2%)", actor: "Adrian Vale" },
  { id: "iev-6", incidentId: "inc-141", at: min(-60 * 26), kind: "detection", message: "Queue depth exceeded 500 messages", actor: "system" },
  { id: "iev-7", incidentId: "inc-141", at: min(-60 * 26 + 120_000), kind: "status-change", message: "Incident created, status set to investigating", actor: "system" },
  { id: "iev-8", incidentId: "inc-141", at: min(-60 * 25 - 8), kind: "mitigation", message: "Rolled back v1.4.1 → v1.4.0, query reverted", actor: "Mira Chen" },
  { id: "iev-9", incidentId: "inc-141", at: min(-60 * 25), kind: "resolution", message: "Queue drained, error rate back to baseline", actor: "system" },
];

// ── SLOs ──────────────────────────────────────────────────────────

export const slos: Slo[] = [
  { id: "slo-4001", businessId: "SLO-4001", serviceId: "svc-api-gateway", serviceName: "api-gateway", kind: "availability", targetPct: 99.95, windowDays: 30, description: "Successful gateway responses" },
  { id: "slo-4002", businessId: "SLO-4002", serviceId: "svc-checkout-api", serviceName: "checkout-api", kind: "availability", targetPct: 99.95, windowDays: 30, description: "Checkout request success ratio" },
  { id: "slo-4003", businessId: "SLO-4003", serviceId: "svc-checkout-api", serviceName: "checkout-api", kind: "latency", targetPct: 99.0, windowDays: 30, description: "p95 checkout latency under 300ms" },
  { id: "slo-4004", businessId: "SLO-4004", serviceId: "svc-payment-worker", serviceName: "payment-worker", kind: "availability", targetPct: 99.9, windowDays: 30, description: "Worker job success ratio" },
  { id: "slo-4005", businessId: "SLO-4005", serviceId: "svc-rpc-router", serviceName: "rpc-router", kind: "availability", targetPct: 99.9, windowDays: 30, description: "RPC route success ratio" },
];

// ── Activity & notifications ──────────────────────────────────────

export const activity: ActivityEvent[] = [
  { id: "act-1", at: min(-11), kind: "deployment", title: "Canary started", detail: "api-gateway v2.1.0 at 5% traffic", refType: "deployment", refId: "dep-1040", actor: "Jonas Reyes" },
  { id: "act-2", at: min(-14), kind: "slo", title: "SLO warning", detail: "checkout-api burn rate above 1×", refType: "slo", refId: "slo-4002", actor: "system" },
  { id: "act-3", at: min(-15), kind: "chain", title: "RPC traffic shifted", detail: "base provider-b weight reduced 20% → 2%", refType: "chain", refId: "chn-base", actor: "Adrian Vale" },
  { id: "act-4", at: min(-22), kind: "incident", title: "Incident detected", detail: "INC-142 Base RPC degradation (SEV-2)", refType: "incident", refId: "inc-142", actor: "system" },
  { id: "act-5", at: min(-31), kind: "deployment", title: "Deployment completed", detail: "checkout-api v1.4.2 → production", refType: "deployment", refId: "dep-1042", actor: "Mira Chen" },
  { id: "act-6", at: min(-64), kind: "deployment", title: "Deployment rolled back", detail: "rpc-router v0.9.8 reverted to v0.9.7", refType: "deployment", refId: "dep-1041", actor: "Adrian Vale" },
  { id: "act-7", at: min(-137), kind: "deployment", title: "Deployment failed", detail: "payment-worker v1.4.1 failed at image build", refType: "deployment", refId: "dep-1039", actor: "Pipeline (main)" },
  { id: "act-8", at: min(-60 * 25), kind: "incident", title: "Incident resolved", detail: "INC-141 queue backlog resolved", refType: "incident", refId: "inc-141", actor: "system" },
];

export const notifications: Notification[] = [
  { id: "ntf-1", kind: "incident", title: "SEV-2: Base RPC degradation", body: "Errors at 11.4% on provider-b. AI analysis available.", severity: "critical", readAt: null, createdAt: min(-22) },
  { id: "ntf-2", kind: "deployment", title: "Canary promoted to 5%", body: "api-gateway v2.1.0 canary healthy for 6 minutes.", severity: "info", readAt: null, createdAt: min(-12) },
  { id: "ntf-3", kind: "slo", title: "Error budget warning", body: "checkout-api burn rate 1.3× over last hour.", severity: "warning", readAt: min(-30), createdAt: min(-14) },
  { id: "ntf-4", kind: "chaos", title: "Chaos experiment scheduled", body: "RPC failure experiment awaiting approval window.", severity: "info", readAt: min(-50), createdAt: min(-58) },
];

// ── Analysis jobs (one completed, so the demo shows results immediately) ──

import { MockRepositoryAnalyzer } from "@/server/adapters/simulated/repository-analyzer";

export const analysisJobs: AnalysisJob[] = (() => {
  const analyzer = new MockRepositoryAnalyzer();
  const goapass = projects.find((p) => p.slug === "goapass");
  if (!goapass) return [];
  const analysis = analyzer.analyze({
    repoUrl: goapass.repoUrl,
    ref: goapass.defaultBranch,
    targetChains: ["base", "polygon"],
    projectSlug: goapass.slug,
  });
  const startedAt = min(-60 * 3);
  return [
    {
      id: "anl-1001",
      businessId: "ANL-1001",
      projectId: goapass.id,
      repoUrl: goapass.repoUrl,
      ref: goapass.defaultBranch,
      status: "complete",
      stageIndex: 6,
      queuedAt: startedAt,
      startedAt: startedAt,
      finishedAt: min(-60 * 3 + 1),
      analysis,
      error: null,
      source: "demo-analysis",
    },
  ];
})();

// Counter baselines so generated IDs continue after the seed.
export const COUNTER_SEED: Record<string, number> = {
  PRJ: 1003,
  SVC: 2005,
  DEP: 1042,
  INC: 142,
  ALT: 142,
  CHN: 3004,
  SLO: 4005,
  ANL: 1001,
};

/** Reset ID counters to the demo baseline (single source of truth). */
export function initCounters(): void {
  resetCounters(COUNTER_SEED);
}
