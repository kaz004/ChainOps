import type { AnalysisJob } from "@/types/domain";

/** AnalysisJob persistence port (docs/01 §6). */
export interface AnalysisJobRepository {
  all(): AnalysisJob[];
  getById(id: string): AnalysisJob | undefined;
  latestForProject(projectId: string): AnalysisJob | undefined;
  historyForProject(projectId: string, limit?: number): AnalysisJob[];
  insert(job: AnalysisJob): AnalysisJob;
  save(job: AnalysisJob): AnalysisJob;
}

/** Deterministic in-memory implementation (spec §46). */
export class InMemoryAnalysisJobRepository implements AnalysisJobRepository {
  private items = new Map<string, AnalysisJob>();

  constructor(seed: AnalysisJob[] = []) {
    for (const job of seed) this.items.set(job.id, job);
  }

  all(): AnalysisJob[] {
    return [...this.items.values()];
  }

  getById(id: string): AnalysisJob | undefined {
    return this.items.get(id);
  }

  latestForProject(projectId: string): AnalysisJob | undefined {
    return this.historyForProject(projectId, 1)[0];
  }

  historyForProject(projectId: string, limit = 10): AnalysisJob[] {
    return this.all()
      .filter((j) => j.projectId === projectId)
      .sort((a, b) => b.queuedAt.localeCompare(a.queuedAt))
      .slice(0, limit);
  }

  insert(job: AnalysisJob): AnalysisJob {
    if (this.items.has(job.id)) throw new Error(`AnalysisJob ${job.id} already exists`);
    this.items.set(job.id, job);
    return job;
  }

  save(job: AnalysisJob): AnalysisJob {
    this.items.set(job.id, job);
    return job;
  }
}
