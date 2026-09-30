import type { Deployment, DeploymentStatus } from "@/types/domain";
import type { DeploymentProvider } from "@/server/core/ports/deployment-provider";
import { DEPLOYMENT_STEPS } from "@/server/core/domain/state-machines";

const STEP_DURATION_MS = 1_500;

export class MockDeploymentProvider implements DeploymentProvider {
  readonly name = "Deterministic demo deployment";
  readonly isDemo = true;

  advance(deployment: Deployment, now: number): Deployment {
    if (!deployment.isSimulatedRun) return deployment;
    if (deployment.status === "queued" && now <= Date.parse(deployment.createdAt)) return deployment;
    if (!(["queued", "running", "canary", "verifying"].includes(deployment.status))) return deployment;

    const elapsed = Math.max(0, now - Date.parse(deployment.createdAt));
    const elapsedSteps = Math.min(Math.floor(elapsed / STEP_DURATION_MS), DEPLOYMENT_STEPS.length);
    const failureIndex = deployment.simulatedFailureStep === null ? -1 : DEPLOYMENT_STEPS.indexOf(deployment.simulatedFailureStep);
    const hasFailed = failureIndex >= 0 && elapsedSteps > failureIndex;
    const completedSteps = hasFailed ? failureIndex : elapsedSteps;
    const next = { ...deployment, steps: deployment.steps.map((step) => ({ ...step })) };
    const currentIndex = Math.min(completedSteps, DEPLOYMENT_STEPS.length - 1);
    const currentTime = new Date(now).toISOString();

    if (completedSteps > 0) {
      next.status = statusForStep(currentIndex);
      next.steps = next.steps.map((step, index) => {
        if (index < completedSteps) {
          return { ...step, status: "success", startedAt: step.startedAt ?? new Date(Date.parse(deployment.createdAt) + index * STEP_DURATION_MS).toISOString(), endedAt: step.endedAt ?? new Date(Date.parse(deployment.createdAt) + (index + 1) * STEP_DURATION_MS).toISOString() };
        }
        if (index === completedSteps && completedSteps < DEPLOYMENT_STEPS.length) {
          return { ...step, status: "running", startedAt: step.startedAt ?? currentTime };
        }
        return step;
      });
      next.logs = [...next.logs];
      if (next.canary === null && next.status === "canary") {
        next.canary = { stablePct: 95, canaryPct: 5 };
      } else if (next.status === "verifying") {
        next.canary = { stablePct: 50, canaryPct: 50 };
      }
    }

    if (hasFailed) {
      const failedStep = next.steps[failureIndex];
      if (failedStep) {
        failedStep.status = "failed";
        failedStep.endedAt = currentTime;
      }
      next.status = "failed";
      next.durationMs = elapsed;
      next.canary = null;
      next.logs = [...next.logs, { id: `dlog-${crypto.randomUUID()}`, at: currentTime, level: "error", message: `Demo failure injected at: ${next.simulatedFailureStep}` }];
    } else if (completedSteps >= DEPLOYMENT_STEPS.length) {
      next.status = "success";
      next.durationMs = elapsed;
      next.canary = null;
      next.steps = next.steps.map((step) => ({ ...step, status: "success", endedAt: step.endedAt ?? currentTime }));
    }

    if (next.status !== deployment.status) {
      next.logs = [...next.logs, { id: `dlog-${crypto.randomUUID()}`, at: currentTime, level: "info", message: `Deployment entered ${next.status.replace(/_/g, " ")}` }];
    }
    if (next.status === deployment.status && next.steps.every((step, index) => step.status === deployment.steps[index]?.status && step.startedAt === deployment.steps[index]?.startedAt && step.endedAt === deployment.steps[index]?.endedAt)) {
      return deployment;
    }
    next.updatedAt = currentTime;
    return next;
  }
}

function statusForStep(index: number): DeploymentStatus {
  if (index < 6) return "running";
  if (index < 8) return "canary";
  return "verifying";
}
