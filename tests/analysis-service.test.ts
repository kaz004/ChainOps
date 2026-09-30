import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AnalysisService } from "@/server/services/analysis-service";
import { NotFoundError, ValidationError } from "@/server/core/errors";

/**
 * Store stub mirroring the seeded shape: one active project with a repo,
 * one archived project, and an empty analysis-job store. Job state advances
 * via the service's settle-on-read against fake timers.
 */
vi.mock("@/server/repositories/store", () => {
  const state = {
    jobs: [] as Record<string, unknown>[],
    activity: [] as { title: string }[],
  };
  const projects = [
    {
      id: "prj-test-project",
      slug: "test-project",
      name: "Test Project",
      status: "active",
      repoUrl: "github.com/acme/goapass",
      defaultBranch: "main",
      chainIds: ["chn-base"],
    },
    {
      id: "prj-archived",
      slug: "archived",
      name: "Archived",
      status: "archived",
      repoUrl: "github.com/acme/x",
      defaultBranch: "main",
      chainIds: [],
    },
  ];
  const chains = [{ id: "chn-base", network: "base" }];

  const findProject = (idOrSlug: string) =>
    projects.find((p) => p.id === idOrSlug || p.slug === idOrSlug);

  return {
    getRepos: () => ({
      projects: {
        getById: (id: string) => findProject(id),
        getBySlug: (slug: string) => findProject(slug),
      },
      chains: { get: (id: string) => chains.find((c) => c.id === id) },
      analysisJobs: {
        insert: (j: Record<string, unknown>) => {
          state.jobs.push(j);
          return j;
        },
        save: (j: Record<string, unknown>) => {
          const idx = state.jobs.findIndex((x) => x.id === j.id);
          if (idx >= 0) state.jobs[idx] = j;
          return j;
        },
        historyForProject: (projectId: string) =>
          state.jobs
            .filter((j) => j.projectId === projectId)
            .sort((a, b) => String(b.queuedAt).localeCompare(String(a.queuedAt))),
        latestForProject: (projectId: string) =>
          [...state.jobs]
            .filter((j) => j.projectId === projectId)
            .sort((a, b) => String(b.queuedAt).localeCompare(String(a.queuedAt)))[0],
      },
      activity: { append: (e: { title: string }) => state.activity.push(e) },
    }),
    __fixtures: state,
  };
});

import * as store from "@/server/repositories/store";
const fixtures = (store as unknown as { __fixtures: { jobs: Record<string, unknown>[]; activity: { title: string }[] } }).__fixtures;

describe("AnalysisService lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    fixtures.jobs.length = 0;
    fixtures.activity.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a job in running state with demo provenance", () => {
    const svc = new AnalysisService();
    const view = svc.start("test-project", { ref: "main" }, "Tester");

    expect(view.job.status).toBe("running");
    expect(view.job.businessId).toMatch(/^ANL-\d+$/);
    expect(view.job.source).toBe("demo-analysis");
    expect(view.job.repoUrl).toBe("github.com/acme/goapass");
    expect(view.progressPct).toBe(0);
    expect(view.currentStage).toContain("Fetching");
  });

  it("records activity when started", () => {
    const svc = new AnalysisService();
    svc.start("test-project", { ref: "main" }, "Tester");
    expect(fixtures.activity.some((a) => a.title === "Repository analysis started")).toBe(true);
  });

  it("deduplicates in-flight jobs", () => {
    const svc = new AnalysisService();
    const first = svc.start("test-project", { ref: "main" }, "Tester");
    const second = svc.start("test-project", { ref: "main" }, "Tester");
    expect(second.job.id).toBe(first.job.id);
    expect(fixtures.jobs).toHaveLength(1);
  });

  it("refuses to analyze archived projects", () => {
    const svc = new AnalysisService();
    expect(() => svc.start("archived", { ref: "main" }, "Tester")).toThrow(ValidationError);
  });

  it("throws NotFoundError for unknown projects", () => {
    const svc = new AnalysisService();
    expect(() => svc.start("nope", { ref: "main" }, "Tester")).toThrow(NotFoundError);
  });

  it("advances through stages and completes with materialized results", () => {
    const svc = new AnalysisService();
    const view = svc.start("test-project", { ref: "main" }, "Tester");

    // Mid-run: partially progressed (3s → stage 2 of 6).
    vi.advanceTimersByTime(3_000);
    const mid = svc.latest("test-project")!;
    expect(mid.job.status).toBe("running");
    expect(mid.job.stageIndex).toBe(2);
    expect(mid.progressPct).toBeGreaterThan(0);
    expect(mid.progressPct).toBeLessThan(100);
    expect(mid.job.analysis).toBeNull();

    // After ~9s all six stages are done → complete with results.
    vi.advanceTimersByTime(6_500);
    const done = svc.latest("test-project")!;
    expect(done.job.status).toBe("complete");
    expect(done.progressPct).toBe(100);
    expect(done.currentStage).toBeNull();
    expect(done.job.analysis).not.toBeNull();
    expect(done.job.analysis?.summary.totalFindings).toBeGreaterThan(0);
    expect(done.job.analysis?.source).toBe("demo-analysis");
    expect(view.job.id).toBe(done.job.id);
  });

  it("returns null latest when never analyzed", () => {
    const svc = new AnalysisService();
    expect(svc.latest("test-project")).toBeNull();
  });

  it("exposes history newest-first", () => {
    const svc = new AnalysisService();
    svc.start("test-project", { ref: "main" }, "Tester");
    vi.advanceTimersByTime(60_000);
    // A read settles the first job to complete, unblocking a second run.
    svc.latest("test-project");
    vi.advanceTimersByTime(60_000); // distinct queuedAt for stable ordering
    const second = svc.start("test-project", { ref: "main" }, "Tester");
    const history = svc.history("test-project");
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0]?.job.id).toBe(second.job.id);
  });
});
