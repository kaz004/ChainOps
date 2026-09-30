import { z } from "zod";
import { CHAIN_NETWORKS, type Chain } from "@/types/domain";

/**
 * RepositoryAnalyzer port (docs/01 §2). Produces a structured analysis of a
 * connected repository. v0 ships MockRepositoryAnalyzer (deterministic demo
 * metadata, clearly labeled "Demo Analysis"); a future real adapter would
 * inspect an actual git provider.
 *
 * IMPORTANT (spec §15/§72): the mock never claims to have inspected GitHub.
 * Results carry `source: "demo-analysis"` and the UI renders the distinction.
 */

/** Ordered analysis stages for progress display (simulated pipeline). */
export const ANALYSIS_STAGES = [
  "Fetching repository metadata",
  "Detecting languages and frameworks",
  "Scanning infrastructure manifests",
  "Running reliability checks",
  "Evaluating security posture",
  "Preparing recommendations",
] as const;
export type AnalysisStageName = (typeof ANALYSIS_STAGES)[number];

// ── Result schemas (Zod = single source of truth for adapter & API) ──

export const findingSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;

export const findingCategorySchema = z.enum([
  "application",
  "infrastructure",
  "security",
  "reliability",
  "dependencies",
]);
export type FindingCategory = z.infer<typeof findingCategorySchema>;

/** Confidence is a 0–1 score plus a coarse band for display. */
export const confidenceSchema = z.object({
  score: z.number().min(0).max(1),
  band: z.enum(["low", "medium", "high"]),
});
export type Confidence = z.infer<typeof confidenceSchema>;

export const analysisFindingSchema = z.object({
  id: z.string().min(1),
  severity: findingSeveritySchema,
  category: findingCategorySchema,
  title: z.string().min(1).max(140),
  description: z.string().min(1).max(600),
  /** Concrete evidence the finding is based on (never invented). */
  evidence: z.string().min(1).max(400),
  recommendation: z.string().min(1).max(400),
  confidence: confidenceSchema,
});
export type AnalysisFinding = z.infer<typeof analysisFindingSchema>;

export const applicationProfileSchema = z.object({
  languages: z.array(z.object({ name: z.string().min(1).max(40), pct: z.number().min(0).max(100) })),
  frameworks: z.array(z.string().min(1).max(60)),
  services: z.array(
    z.object({
      name: z.string().min(1).max(80),
      kind: z.enum(["api", "worker", "frontend", "contract"]),
    }),
  ),
  dependencies: z.array(
    z.object({
      name: z.string().min(1).max(80),
      version: z.string().min(1).max(40),
      kind: z.enum(["runtime", "dev"]),
      risk: z.enum(["none", "outdated", "vulnerable-version"]).optional(),
      note: z.string().max(160).optional(),
    }),
  ),
});
export type ApplicationProfile = z.infer<typeof applicationProfileSchema>;

export const infrastructureProfileSchema = z.object({
  docker: z.boolean(),
  kubernetes: z.boolean(),
  terraform: z.boolean(),
  helm: z.boolean(),
  cicd: z.enum(["github-actions", "gitlab-ci", "circleci", "none"]),
  notes: z.array(z.string().min(1).max(200)).max(8),
});
export type InfrastructureProfile = z.infer<typeof infrastructureProfileSchema>;

export const repositoryAnalysisSchema = z.object({
  /** Provenance marker — mock results are demo analyses, not real scans. */
  source: z.enum(["demo-analysis", "real-integration"]),
  repoUrl: z.string().min(1),
  ref: z.string().min(1),
  /** Simulated commit the (demo) analysis is pinned to. */
  commitSha: z.string().length(8),
  status: z.enum(["complete", "failed"]),
  application: applicationProfileSchema,
  infrastructure: infrastructureProfileSchema,
  /** Target chains declared by the project (context, not a finding). */
  targetChains: z.array(z.enum(CHAIN_NETWORKS)),
  findings: z.array(analysisFindingSchema),
  summary: z.object({
    totalFindings: z.number().int().min(0),
    bySeverity: z.record(findingSeveritySchema, z.number().int().min(0)),
    /** Overall readiness signal derived from finding severities. */
    readiness: z.enum(["ready", "needs-work", "at-risk"]),
  }),
});
export type RepositoryAnalysis = z.infer<typeof repositoryAnalysisSchema>;

/** Input contract for any analyzer adapter. */
export interface AnalyzeRepositoryInput {
  repoUrl: string;
  ref: string;
  /** Project context used for chain-aware findings. */
  targetChains: Chain["network"][];
  projectSlug: string;
}

// ── Port ──────────────────────────────────────────────────────────

export interface RepositoryAnalyzer {
  /** Human-readable adapter name for provenance display. */
  readonly name: string;
  /** True when the adapter produces demo data (drives UI labeling). */
  readonly isDemo: boolean;
  analyze(input: AnalyzeRepositoryInput): RepositoryAnalysis;
  /** Informational strengths for the UI (not findings). */
  strengthsFor(input: AnalyzeRepositoryInput): string[];
}
