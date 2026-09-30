/**
 * MockRepositoryAnalyzer — the v0 RepositoryAnalyzer adapter (docs/01 §2).
 *
 * Derives results from deterministic demo metadata: curated profiles for the
 * seeded demo repositories, hashed profiles for anything else. It does NOT
 * contact GitHub or inspect any real repository — every result is marked
 * `source: "demo-analysis"` so the UI can label it honestly (spec §15/§72).
 */

import { hashSeed } from "@/server/core/simulation/prng";
import {
  repositoryAnalysisSchema,
  type AnalyzeRepositoryInput,
  type AnalysisFinding,
  type Confidence,
  type RepositoryAnalysis,
  type RepositoryAnalyzer,
} from "@/server/core/ports/repository-analyzer";

type RepoKey = "goapass" | "crosschain-payments" | "inference-gateway";

interface RepoProfile {
  key: RepoKey;
  commitSha: string;
  languages: { name: string; pct: number }[];
  frameworks: string[];
  services: { name: string; kind: "api" | "worker" | "frontend" | "contract" }[];
  infrastructure: {
    docker: boolean;
    kubernetes: boolean;
    terraform: boolean;
    helm: boolean;
    cicd: "github-actions" | "gitlab-ci" | "circleci" | "none";
    notes: string[];
  };
  /** Which of the seven reliability checks fail for this repo. */
  reliabilityGaps: ReliabilityCheckId[];
  securityFindings: { title: string; description: string; evidence: string; severity: "critical" | "high" | "medium" | "low" }[];
  dependencies: RepositoryAnalysis["application"]["dependencies"];
  /** Findings we deliberately mark as healthy/passing (informational). */
  strengths: string[];
}

type ReliabilityCheckId =
  | "missing-health-endpoint"
  | "missing-readiness-probe"
  | "missing-resource-limits"
  | "missing-timeout"
  | "missing-retry-policy"
  | "missing-observability"
  | "missing-tests";

const RELIABILITY_CHECKS: Record<ReliabilityCheckId, {
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
}> = {
  "missing-health-endpoint": {
    title: "No health endpoint exposed",
    description:
      "The service does not expose an HTTP health endpoint, so load balancers and the deployment platform cannot distinguish a live process from a broken one.",
    evidence: "No /health or /healthz route registered in any service entrypoint.",
    recommendation: "Add a /healthz endpoint that returns 200 only when critical dependencies are reachable.",
    severity: "high",
    confidence: 0.9,
  },
  "missing-readiness-probe": {
    title: "Missing readiness probe configuration",
    description:
      "No readiness probe is defined, so traffic can be routed to pods that have not finished initializing or have lost their downstream dependencies.",
    evidence: "No readinessProbe block found in workload manifests.",
    recommendation: "Define a readinessProbe that gates traffic until warm-up and dependency checks pass.",
    severity: "high",
    confidence: 0.85,
  },
  "missing-resource-limits": {
    title: "Containers run without resource limits",
    description:
      "CPU and memory limits are not set, so a runaway process can starve neighboring workloads on the same node.",
    evidence: "No resources.limits/requests found in workload manifests.",
    recommendation: "Set requests and limits for CPU and memory on every container.",
    severity: "medium",
    confidence: 0.8,
  },
  "missing-timeout": {
    title: "Outbound calls without timeouts",
    description:
      "HTTP and RPC clients have no deadline configured; a slow downstream (for example an RPC provider) will hold connections and exhaust worker capacity.",
    evidence: "Client initializations found without timeout/deadline options.",
    recommendation: "Give every outbound call an explicit timeout shorter than the request budget.",
    severity: "high",
    confidence: 0.75,
  },
  "missing-retry-policy": {
    title: "No retry policy for transient failures",
    description:
      "Transient network and 5xx errors are not retried, converting short blips into user-visible failures.",
    evidence: "No retry/backoff wrapper detected around outbound clients.",
    recommendation: "Add bounded retries with exponential backoff and jitter for idempotent operations.",
    severity: "medium",
    confidence: 0.7,
  },
  "missing-observability": {
    title: "No structured telemetry exported",
    description:
      "The service emits no structured logs, metrics, or traces, which makes incidents nearly impossible to diagnose in production.",
    evidence: "No OpenTelemetry/metrics/logging SDK initializations found.",
    recommendation: "Adopt OpenTelemetry: structured logs with trace ids, RED metrics, and span export.",
    severity: "critical",
    confidence: 0.8,
  },
  "missing-tests": {
    title: "No automated tests detected",
    description:
      "The repository contains no test suites, so regressions reach production undetected and deployments carry unbounded risk.",
    evidence: "No test directories, test scripts, or CI test steps found.",
    recommendation: "Add unit and integration tests and run them as a required CI stage.",
    severity: "high",
    confidence: 0.9,
  },
};

// ── Curated demo profiles (deterministic, no network) ─────────────

const PROFILES: Record<RepoKey, RepoProfile> = {
  goapass: {
    key: "goapass",
    commitSha: "8f29c1a4",
    languages: [
      { name: "TypeScript", pct: 62 },
      { name: "Solidity", pct: 21 },
      { name: "JavaScript", pct: 11 },
      { name: "Shell", pct: 6 },
    ],
    frameworks: ["Next.js", "Fastify", "ethers.js", "Vitest"],
    services: [
      { name: "api-gateway", kind: "api" },
      { name: "checkout-api", kind: "api" },
      { name: "payment-worker", kind: "worker" },
      { name: "notification-service", kind: "worker" },
    ],
    infrastructure: {
      docker: true,
      kubernetes: true,
      terraform: false,
      helm: true,
      cicd: "github-actions",
      notes: [
        "Helm chart per service under deploy/charts/",
        "Single GitHub Actions workflow for CI and deploy",
      ],
    },
    reliabilityGaps: ["missing-retry-policy", "missing-timeout"],
    securityFindings: [
      {
        title: "Two dependencies with known advisories",
        description: "Runtime dependencies resolve to versions with published security advisories.",
        evidence: "package-lock.json resolves ws@8.5.0 (GHSA-3h5v-q93c-6h6q) and undici@5.28.2 (GHSA-9q28).",
        severity: "medium",
      },
      {
        title: "Broad secret-scanner pattern match",
        description: "A high-entropy string in test fixtures resembles an API key format.",
        evidence: "tests/fixtures/rpc-key.ts contains a 40-char hex constant.",
        severity: "low",
      },
    ],
    dependencies: [
      { name: "next", version: "15.1.0", kind: "runtime" },
      { name: "fastify", version: "5.2.1", kind: "runtime" },
      { name: "ethers", version: "6.13.4", kind: "runtime" },
      { name: "ws", version: "8.5.0", kind: "runtime", risk: "vulnerable-version", note: "GHSA-3h5v-q93c-6h6q" },
      { name: "undici", version: "5.28.2", kind: "runtime", risk: "vulnerable-version", note: "GHSA-9q28" },
      { name: "pino", version: "9.6.0", kind: "runtime" },
      { name: "vitest", version: "3.2.4", kind: "dev" },
    ],
    strengths: ["Health endpoints present on all API services", "Readiness probes configured in Helm values", "Structured logging with trace ids", "Test coverage enforced in CI"],
  },
  "crosschain-payments": {
    key: "crosschain-payments",
    commitSha: "c41d77b9",
    languages: [
      { name: "TypeScript", pct: 54 },
      { name: "Solidity", pct: 33 },
      { name: "Go", pct: 13 },
    ],
    frameworks: ["NestJS", "hardhat", "viem", "Jest"],
    services: [
      { name: "rpc-router", kind: "api" },
      { name: "payment-worker", kind: "worker" },
      { name: "settlement-contracts", kind: "contract" },
    ],
    infrastructure: {
      docker: true,
      kubernetes: true,
      terraform: true,
      helm: true,
      cicd: "github-actions",
      notes: ["Terraform modules for chain infra", "Canary deployment wired through Helm values"],
    },
    reliabilityGaps: ["missing-health-endpoint", "missing-observability", "missing-tests"],
    securityFindings: [
      {
        title: "Private key referenced in configuration file",
        description: "A deployer private key is referenced by an environment variable defined in a committed file.",
        evidence: ".env.production defines DEPLOYER_PRIVATE_KEY=... (value redacted by scanner).",
        severity: "critical",
      },
      {
        title: "Container image runs as root",
        description: "Docker images do not set USER, so containers run as root.",
        evidence: "Dockerfile lacks a USER directive in the final stage.",
        severity: "medium",
      },
    ],
    dependencies: [
      { name: "@nestjs/core", version: "10.4.15", kind: "runtime" },
      { name: "viem", version: "2.23.5", kind: "runtime" },
      { name: "hardhat", version: "2.22.17", kind: "dev" },
      { name: "jest", version: "29.7.0", kind: "dev" },
      { name: "dotenv", version: "16.4.7", kind: "runtime" },
    ],
    strengths: ["Terraform-managed infrastructure", "Canary deployment strategy in place"],
  },
  "inference-gateway": {
    key: "inference-gateway",
    commitSha: "de30b2c5",
    languages: [
      { name: "Rust", pct: 71 },
      { name: "TypeScript", pct: 29 },
    ],
    frameworks: ["axum", "tokio", "alloy", "Next.js"],
    services: [{ name: "inference-gateway", kind: "api" }],
    infrastructure: {
      docker: true,
      kubernetes: false,
      terraform: false,
      helm: false,
      cicd: "gitlab-ci",
      notes: ["Single-binary deployment target", "No workload manifests yet"],
    },
    reliabilityGaps: [
      "missing-readiness-probe",
      "missing-resource-limits",
      "missing-observability",
    ],
    securityFindings: [
      {
        title: "Dependency pinned to outdated major",
        description: "A core dependency is pinned several majors behind current stable.",
        evidence: "Cargo.toml pins tokio 1.8.4 (current stable 1.4x).",
        severity: "low",
      },
    ],
    dependencies: [
      { name: "axum", version: "0.8.1", kind: "runtime" },
      { name: "tokio", version: "1.8.4", kind: "runtime", risk: "outdated", note: "pinned several majors behind" },
      { name: "alloy", version: "0.12.6", kind: "runtime" },
    ],
    strengths: ["Typed Rust service with strict lint policy"],
  },
};

function demoRepoKey(repoUrl: string): RepoKey | null {
  const url = repoUrl.toLowerCase();
  if (url.includes("goapass")) return "goapass";
  if (url.includes("crosschain")) return "crosschain-payments";
  if (url.includes("inference")) return "inference-gateway";
  return null;
}

/** Deterministic 8-hex commit for unknown repos (seeded hash, not random). */
function derivedCommit(repoUrl: string, ref: string): string {
  const n = hashSeed(`${repoUrl}@${ref}`);
  return (n >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

function confidence(score: number): Confidence {
  return { score, band: score >= 0.8 ? "high" : score >= 0.55 ? "medium" : "low" };
}

function reliabilityFinding(id: ReliabilityCheckId): AnalysisFinding {
  const c = RELIABILITY_CHECKS[id];
  return {
    id: `rel-${id}`,
    severity: c.severity,
    category: "reliability",
    title: c.title,
    description: c.description,
    evidence: c.evidence,
    recommendation: c.recommendation,
    confidence: confidence(c.confidence),
  };
}

/**
 * For repos without a curated profile: derive a stable, plausible profile
 * from a seeded hash of the repo URL. Deterministic per repo — same input,
 * same analysis (spec §46).
 */
function synthesizedProfile(repoUrl: string): RepoProfile {
  const rand = (salt: string): number => {
    const x = hashSeed(`${repoUrl}:${salt}`) / 4294967296;
    return x;
  };
  const pick = <T,>(salt: string, arr: T[]): T => arr[Math.floor(rand(salt) * arr.length)]!;

  const languages: { name: string; pct: number }[] = [
    { name: "TypeScript", pct: 55 + Math.floor(rand("lang1") * 25) },
    { name: "Solidity", pct: 10 + Math.floor(rand("lang2") * 25) },
    { name: "Go", pct: 5 + Math.floor(rand("lang3") * 10) },
  ];
  const total = languages.reduce((a, l) => a + l.pct, 0);
  languages.forEach((l) => (l.pct = Math.round((l.pct / total) * 100)));

  const allGaps = Object.keys(RELIABILITY_CHECKS) as ReliabilityCheckId[];
  const gapCount = 2 + Math.floor(rand("gaps") * 3);
  const gaps = [...new Set(allGaps.map((_, i) => ({ i, r: rand(`gap${i}`) })))
    .size ? allGaps.filter((g, i) => i < gapCount + 2 && rand(`g${g}`) > 0.35) : allGaps.slice(0, gapCount)];

  return {
    key: "goapass", // unused for synthesized profiles
    commitSha: derivedCommit(repoUrl, "HEAD"),
    languages,
    frameworks: pick("fw", [["Fastify", "Vitest"], ["NestJS", "Jest"], ["Express", "Mocha"]]),
    services: [{ name: repoUrl.split("/")[1] ?? "service", kind: "api" }],
    infrastructure: {
      docker: rand("docker") > 0.2,
      kubernetes: rand("k8s") > 0.4,
      terraform: rand("tf") > 0.6,
      helm: rand("helm") > 0.5,
      cicd: rand("ci") > 0.5 ? "github-actions" : "none",
      notes: ["Profile synthesized from demo metadata for this repository"],
    },
    reliabilityGaps: gaps.length > 0 ? gaps : ["missing-tests"],
    securityFindings:
      rand("sec") > 0.5
        ? [{
            title: "Dependency with known advisory",
            description: "A runtime dependency resolves to a version with a published advisory.",
            evidence: "Demo metadata flags one package-lock entry.",
            severity: "medium",
          }]
        : [],
    dependencies: [
      { name: "typescript", version: "5.9.3", kind: "dev" },
      { name: "zod", version: "3.25.76", kind: "runtime" },
    ],
    strengths: [],
  };
}

// ── Adapter ───────────────────────────────────────────────────────

export class MockRepositoryAnalyzer implements RepositoryAnalyzer {
  readonly name = "Mock Repository Analyzer";
  readonly isDemo = true;

  analyze(input: AnalyzeRepositoryInput): RepositoryAnalysis {
    const profile = demoRepoKey(input.repoUrl)
      ? PROFILES[demoRepoKey(input.repoUrl)!]
      : synthesizedProfile(input.repoUrl);

    const findings: AnalysisFinding[] = [];

    // Reliability: the seven standard checks (spec §15).
    for (const gap of profile.reliabilityGaps) {
      findings.push(reliabilityFinding(gap));
    }

    // Security.
    for (const s of profile.securityFindings) {
      findings.push({
        id: `sec-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        severity: s.severity,
        category: "security",
        title: s.title,
        description: s.description,
        evidence: s.evidence,
        recommendation:
          s.severity === "critical"
            ? "Rotate the credential immediately, move it to a secret manager, and add the file to .gitignore."
            : "Update or pin the affected component and re-scan before the next deployment.",
        confidence: confidence(0.8),
      });
    }

    // Dependencies at risk.
    for (const dep of profile.dependencies) {
      if (dep.risk === "vulnerable-version") {
        findings.push({
          id: `dep-${dep.name}`,
          severity: "medium",
          category: "dependencies",
          title: `${dep.name}@${dep.version} has a known advisory`,
          description: `The lockfile resolves ${dep.name} to a version with a published security advisory.`,
          evidence: dep.note ?? "Advisory database match in lockfile.",
          recommendation: `Upgrade ${dep.name} to the patched minor release and re-run the security scan.`,
          confidence: confidence(0.85),
        });
      } else if (dep.risk === "outdated") {
        findings.push({
          id: `dep-${dep.name}`,
          severity: "low",
          category: "dependencies",
          title: `${dep.name} is pinned to an outdated major`,
          description: `${dep.name}@${dep.version} lags current stable, accumulating fixes and features.`,
          evidence: dep.note ?? "Version comparison against registry metadata.",
          recommendation: `Plan an upgrade of ${dep.name} to current stable within the next maintenance window.`,
          confidence: confidence(0.7),
        });
      }
    }

    // Infrastructure gaps as findings.
    if (!profile.infrastructure.kubernetes) {
      findings.push({
        id: "infra-no-kubernetes",
        severity: "medium",
        category: "infrastructure",
        title: "No workload manifests for Kubernetes",
        description:
          "The repository has no Kubernetes manifests or Helm chart, so deployment automation cannot manage rollouts, probes, or scaling.",
        evidence: "No deploy/ manifests or Chart.yaml found.",
        recommendation: "Add a Helm chart with probes, resource limits, and rolling-update strategy.",
        confidence: confidence(0.85),
      });
    }
    if (profile.infrastructure.cicd === "none") {
      findings.push({
        id: "infra-no-cicd",
        severity: "high",
        category: "infrastructure",
        title: "No CI/CD pipeline configured",
        description: "Without a pipeline, builds and deployments are manual and unauditable.",
        evidence: "No workflow files found for any CI provider.",
        recommendation: "Add a CI workflow that runs tests, scans, and publishes images.",
        confidence: confidence(0.8),
      });
    }

    // Application: contract projects on multichain targets → positive note only.
    void input.targetChains;

    const bySeverity: RepositoryAnalysis["summary"]["bySeverity"] = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0,
    };
    for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;

    const readiness =
      (bySeverity.critical ?? 0) > 0 ? "at-risk" : (bySeverity.high ?? 0) > 2 ? "needs-work" : "ready";

    const analysis: RepositoryAnalysis = {
      source: "demo-analysis",
      repoUrl: input.repoUrl,
      ref: input.ref,
      commitSha: profile.commitSha,
      status: "complete",
      application: {
        languages: profile.languages,
        frameworks: profile.frameworks,
        services: profile.services,
        dependencies: profile.dependencies,
      },
      infrastructure: profile.infrastructure,
      targetChains: input.targetChains,
      findings,
      summary: {
        totalFindings: findings.length,
        bySeverity,
        readiness,
      },
    };

    // Validate at the boundary so any adapter bug becomes a loud error.
    return repositoryAnalysisSchema.parse(analysis);
  }

  /** Informational strengths for the UI (not findings). */
  strengthsFor(input: AnalyzeRepositoryInput): string[] {
    const profile = demoRepoKey(input.repoUrl)
      ? PROFILES[demoRepoKey(input.repoUrl)!]
      : synthesizedProfile(input.repoUrl);
    return profile.strengths;
  }
}
