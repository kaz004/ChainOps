import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRepos } from "@/server/repositories/store";
import { DeploymentService } from "@/server/services/deployment-service";
import { PipelineService } from "@/server/services/pipeline-service";

describe("PipelineService", () => {
  let service: PipelineService;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
    resetRepos();
    service = new PipelineService(new DeploymentService());
  });
  afterEach(() => vi.useRealTimers());

  const input = { projectId: "prj-goapass", serviceId: "svc-checkout-api", version: "v2.0.0", gitSha: "1234abcd", environment: "staging" as const };

  it("runs ordered stages and creates a linked simulated deployment", () => {
    const created = service.create(input);
    expect(created.status).toBe("queued");
    vi.advanceTimersByTime(13_200);
    const completed = service.get(created.businessId);
    expect(completed.status).toBe("success");
    expect(completed.stages.map((stage) => stage.name)).toEqual(["Source", "Lint", "Unit tests", "Integration tests", "Contract tests", "Security scan", "Build", "Staging", "Smoke tests", "Canary", "Production"]);
    expect(completed.stages.every((stage) => stage.status === "success")).toBe(true);
    expect(completed.deploymentId).toMatch(/^DEP-/);
    const deployment = new DeploymentService().get(completed.deploymentId!);
    expect(deployment.trigger).toBe("pipeline");
    expect(deployment.isSimulatedRun).toBe(true);
  });

  it("fails at the selected stage and retries from that stage", () => {
    const created = service.create({ ...input, failureStage: "Security scan" });
    vi.advanceTimersByTime(7_200);
    const failed = service.get(created.businessId);
    expect(failed.status).toBe("failed");
    expect(failed.stages[5]?.status).toBe("failed");
    const retried = service.retryFailedStage(created.businessId);
    expect(retried.status).toBe("running");
    expect(retried.stages[5]?.status).toBe("running");
    vi.advanceTimersByTime(7_200);
    expect(service.get(created.businessId).status).toBe("success");
  });

  it("cancels an active run and rejects retrying a non-failed run", () => {
    const created = service.create(input);
    const cancelled = service.cancel(created.businessId);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.stages[0]?.status).toBe("cancelled");
    expect(() => service.retryFailedStage(created.businessId)).toThrow("Only a failed pipeline run can be retried");
  });
});
