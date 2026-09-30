import { z } from "zod";
import type { AnalysisJob } from "@/types/domain";
import { getRepos } from "@/server/repositories/store";
import { nextBusinessId } from "@/server/core/domain/ids";
import { ANALYSIS_STAGES, type RepositoryAnalyzer } from "@/server/core/ports/repository-analyzer";
import { MockRepositoryAnalyzer } from "@/server/adapters/simulated/repository-analyzer";
import { NotFoundError, ValidationError } from "@/server/core/errors";

/**
 * AnalysisService — the repository-analysis application workflow:
 * Project → Repository → Analyze → Analysis Job → Analysis Results.
 *
 * Job progression is simulated on the virtual clock: a job advances one stage
 * every STAGE_ADVANCE_MS of wall time and completes after all stages, at
 * which point the analyzer's result is materialized. Reads settle job state,
 * so no background timer is needed and behavior stays deterministic.
 */

/** Wall-time per analysis stage (6 stages ≈ 9s total in demo). */
const STAGE_ADVANCE_MS = 1_500;

export const startAnalysisSchema = z.object({
  ref: z.string().min(1).max(80).default("main"),
});

export type StartAnalysisInput = z.infer<typeof startAnalysisSchema>;

export interface AnalysisJobView {
  job: AnalysisJob;
  /** 0–100 progress across the simulated pipeline. */
  progressPct: number;
  currentStage: string | null;
  totalStages: number;
}

export class AnalysisService {
  private readonly analyzer: RepositoryAnalyzer;

  constructor(analyzer: RepositoryAnalyzer = new MockRepositoryAnalyzer()) {
    this.analyzer = analyzer;
  }

  /** Start a new analysis for a project (uses the project's repository). */
  start(projectIdOrSlug: string, input: StartAnalysisInput, actor: string): AnalysisJobView {
    const repos = getRepos();
    const project =
      repos.projects.getById(projectIdOrSlug) ?? repos.projects.getBySlug(projectIdOrSlug);
    if (!project) throw new NotFoundError("Project", projectIdOrSlug);
    if (project.status === "archived") {
      throw new ValidationError("Archived projects cannot be analyzed. Restore the project first.");
    }
    if (!project.repoUrl) {
      throw new ValidationError("Project has no repository connected.");
    }

    const inFlight = repos.analysisJobs
      .historyForProject(project.id)
      .find((j) => j.status === "queued" || j.status === "running");
    if (inFlight) {
      // Return the existing job instead of duplicating work.
      return this.toView(inFlight);
    }

    const now = new Date().toISOString();
    const businessId = nextBusinessId("ANL");
    const job: AnalysisJob = {
      id: businessId.toLowerCase(),
      businessId,
      projectId: project.id,
      repoUrl: project.repoUrl,
      ref: input.ref,
      status: "running",
      stageIndex: 0,
      queuedAt: now,
      startedAt: now,
      finishedAt: null,
      analysis: null,
      error: null,
      source: this.analyzer.isDemo ? "demo-analysis" : "real-integration",
    };
    repos.analysisJobs.insert(job);

    repos.activity.append({
      id: `act-${crypto.randomUUID()}`,
      at: now,
      kind: "project",
      title: "Repository analysis started",
      detail: `${project.name}: ${project.repoUrl}@${input.ref} (${this.analyzer.name})`,
      refType: "project",
      refId: project.id,
      actor,
    });

    return this.toView(job);
  }

  /** Latest job for a project, settled to its current simulated state. */
  latest(projectIdOrSlug: string): AnalysisJobView | null {
    const repos = getRepos();
    const project =
      repos.projects.getById(projectIdOrSlug) ?? repos.projects.getBySlug(projectIdOrSlug);
    if (!project) throw new NotFoundError("Project", projectIdOrSlug);

    const job = repos.analysisJobs.latestForProject(project.id);
    if (!job) return null;
    return this.toView(this.settle(job));
  }

  /** Recent job history for a project. */
  history(projectIdOrSlug: string, limit = 5): AnalysisJobView[] {
    const repos = getRepos();
    const project =
      repos.projects.getById(projectIdOrSlug) ?? repos.projects.getBySlug(projectIdOrSlug);
    if (!project) throw new NotFoundError("Project", projectIdOrSlug);
    return repos.analysisJobs
      .historyForProject(project.id, limit)
      .map((j) => this.toView(this.settle(j)));
  }

  /**
   * Advance the job through simulated stages based on elapsed wall time.
   * Called on every read — deterministic, no timers.
   */
  private settle(job: AnalysisJob): AnalysisJob {
    if (job.status !== "running" || job.startedAt === null) return job;

    const repos = getRepos();
    const elapsed = Date.now() - Date.parse(job.startedAt);
    const stageIndex = Math.min(Math.floor(elapsed / STAGE_ADVANCE_MS), ANALYSIS_STAGES.length);

    if (stageIndex >= ANALYSIS_STAGES.length) {
      // Materialize the analyzer result once, at completion.
      const project = repos.projects.getById(job.projectId);
      const analysis = this.analyzer.analyze({
        repoUrl: job.repoUrl,
        ref: job.ref,
        targetChains: project?.chainIds.map((cid) => {
          const chain = repos.chains.get(cid);
          return chain?.network ?? "ethereum";
        }) ?? [],
        projectSlug: project?.slug ?? "unknown",
      });

      const settled: AnalysisJob = {
        ...job,
        status: analysis.status === "complete" ? "complete" : "failed",
        stageIndex: ANALYSIS_STAGES.length,
        finishedAt: new Date().toISOString(),
        analysis,
        error: analysis.status === "complete" ? null : "Analysis failed",
      };
      repos.analysisJobs.save(settled);
      return settled;
    }

    if (stageIndex !== job.stageIndex) {
      const progressed: AnalysisJob = { ...job, stageIndex };
      repos.analysisJobs.save(progressed);
      return progressed;
    }
    return job;
  }

  private toView(job: AnalysisJob): AnalysisJobView {
    const total = ANALYSIS_STAGES.length;
    const progressPct =
      job.status === "complete" || job.status === "failed"
        ? 100
        : Math.min(100, Math.round((job.stageIndex / total) * 100));
    return {
      job,
      progressPct,
      currentStage: job.status === "running" ? (ANALYSIS_STAGES[job.stageIndex] ?? null) : null,
      totalStages: total,
    };
  }
}
