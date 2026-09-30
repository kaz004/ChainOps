import { describe, expect, it } from "vitest";
import { MockDeploymentProvider } from "@/server/adapters/simulated/deployment-provider";
import { DEPLOYMENT_STEPS } from "@/server/core/domain/state-machines";
import type { Deployment } from "@/types/domain";
import { DeploymentService } from "@/server/services/deployment-service";
import { PolicyBlockedError } from "@/server/core/errors";

function makeDeployment(simulatedFailureStep: string | null = null): Deployment {
  return {
    id: "dep-test", businessId: "DEP-9001", projectId: "prj-test", serviceId: "svc-test",
    serviceName: "api", version: "v1.0.0", gitSha: "1234abcd", environment: "staging",
    trigger: "manual", status: "queued", steps: DEPLOYMENT_STEPS.map((name, index) => ({
      id: `step-${index}`, name, status: "pending", startedAt: null, endedAt: null,
    })),
    logs: [], simulatedFailureStep, isSimulatedRun: true, canary: null, durationMs: null, triggeredByName: "Tester",
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("MockDeploymentProvider", () => {
  const provider = new MockDeploymentProvider();
  const startedAt = Date.parse("2026-10-01T00:00:00.000Z");

  it("advances deterministically through canary to success", () => {
    const deployment = makeDeployment();
    expect(provider.advance(deployment, startedAt + 1_500).status).toBe("running");
    const canary = provider.advance(deployment, startedAt + 10_500);
    expect(canary.status).toBe("canary");
    expect(canary.canary).toEqual({ stablePct: 95, canaryPct: 5 });
    const complete = provider.advance(deployment, startedAt + 15_000);
    expect(complete.status).toBe("success");
    expect(complete.steps.every((step) => step.status === "success")).toBe(true);
    expect(complete.durationMs).toBe(15_000);
  });

  it("fails at the selected demo step and stops later steps", () => {
    const deployment = makeDeployment("Security scan");
    const failed = provider.advance(deployment, startedAt + 6_000);
    expect(failed.status).toBe("failed");
    expect(failed.steps[2]?.status).toBe("failed");
    expect(failed.steps.slice(3).every((step) => step.status === "pending")).toBe(true);
    expect(failed.logs.some((log) => log.level === "error")).toBe(true);
  });
});

describe("production SLO policy hook", () => {
  it("rejects a production deployment when policy reports a blocked objective", () => {
    const service = new DeploymentService(undefined, () => "SLO-4002 exceeded its burn threshold.");
    expect(() => service.create({
      projectId: "prj-goapass",
      serviceId: "svc-checkout-api",
      version: "1.2.3",
      gitSha: "1234abcd",
      environment: "production",
    })).toThrowError(PolicyBlockedError);
  });
});
