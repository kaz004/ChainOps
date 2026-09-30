import { describe, expect, it } from "vitest";
import {
  canTransitionDeployment,
  transitionDeployment,
  isDeploymentActive,
} from "@/server/core/domain/state-machines";
import {
  canTransitionIncident,
  isIncidentActive,
} from "@/server/core/domain/state-machines";
import { canTransitionPipeline, canTransitionPipelineStage } from "@/server/core/domain/state-machines";
import { canTransitionChaosRun } from "@/server/core/domain/state-machines";
import { canTransitionRemediation } from "@/server/core/domain/state-machines";

describe("deployment state machine", () => {
  it("allows the happy path", () => {
    expect(canTransitionDeployment("queued", "running")).toBe(true);
    expect(canTransitionDeployment("running", "canary")).toBe(true);
    expect(canTransitionDeployment("canary", "verifying")).toBe(true);
    expect(canTransitionDeployment("verifying", "success")).toBe(true);
  });

  it("allows failure and rollback path", () => {
    expect(canTransitionDeployment("running", "failed")).toBe(true);
    expect(canTransitionDeployment("failed", "rollback_pending")).toBe(true);
    expect(canTransitionDeployment("rollback_pending", "rolling_back")).toBe(true);
    expect(canTransitionDeployment("rolling_back", "rolled_back")).toBe(true);
  });

  it("rejects impossible transitions", () => {
    expect(canTransitionDeployment("success", "running")).toBe(false);
    expect(canTransitionDeployment("queued", "success")).toBe(false);
    expect(canTransitionDeployment("rolled_back", "running")).toBe(false);
    expect(canTransitionDeployment("cancelled", "running")).toBe(false);
  });

  it("returns a typed failure reason", () => {
    const result = transitionDeployment("success", "running");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("success");
  });

  it("classifies active states", () => {
    expect(isDeploymentActive("running")).toBe(true);
    expect(isDeploymentActive("rolling_back")).toBe(true);
    expect(isDeploymentActive("success")).toBe(false);
    expect(isDeploymentActive("failed")).toBe(false);
  });
});

describe("incident state machine", () => {
  it("follows the workflow", () => {
    expect(canTransitionIncident("detected", "investigating")).toBe(true);
    expect(canTransitionIncident("investigating", "mitigating")).toBe(true);
    expect(canTransitionIncident("mitigating", "monitoring")).toBe(true);
    expect(canTransitionIncident("monitoring", "resolved")).toBe(true);
  });

  it("permits direct resolution from active states", () => {
    expect(canTransitionIncident("detected", "resolved")).toBe(true);
    expect(canTransitionIncident("investigating", "resolved")).toBe(true);
  });

  it("rejects transitions from resolved", () => {
    expect(canTransitionIncident("resolved", "investigating")).toBe(false);
    expect(canTransitionIncident("resolved", "monitoring")).toBe(false);
  });

  it("classifies active incidents", () => {
    expect(isIncidentActive("detected")).toBe(true);
    expect(isIncidentActive("resolved")).toBe(false);
  });
});

describe("pipeline state machines", () => {
  it("allows running pipelines to complete or fail and failed runs to retry", () => {
    expect(canTransitionPipeline("queued", "running")).toBe(true);
    expect(canTransitionPipeline("running", "success")).toBe(true);
    expect(canTransitionPipeline("running", "failed")).toBe(true);
    expect(canTransitionPipeline("failed", "running")).toBe(true);
    expect(canTransitionPipeline("success", "running")).toBe(false);
  });

  it("requires a running stage before success and permits failed-stage retry", () => {
    expect(canTransitionPipelineStage("pending", "running")).toBe(true);
    expect(canTransitionPipelineStage("running", "success")).toBe(true);
    expect(canTransitionPipelineStage("pending", "success")).toBe(false);
    expect(canTransitionPipelineStage("failed", "running")).toBe(true);
    expect(canTransitionPipelineStage("success", "running")).toBe(false);
  });
});

describe("chaos run transitions", () => {
  it("only permits terminal transitions from running", () => {
    expect(canTransitionChaosRun("running", "aborted")).toBe(true);
    expect(canTransitionChaosRun("running", "completed")).toBe(true);
    expect(canTransitionChaosRun("completed", "running")).toBe(false);
    expect(canTransitionChaosRun("aborted", "completed")).toBe(false);
  });
});

describe("remediation transitions", () => {
  it("requires approval before execution and verifies through terminal states", () => {
    expect(canTransitionRemediation("proposed", "approved")).toBe(true);
    expect(canTransitionRemediation("proposed", "executing")).toBe(false);
    expect(canTransitionRemediation("approved", "executing")).toBe(true);
    expect(canTransitionRemediation("executing", "succeeded")).toBe(true);
    expect(canTransitionRemediation("succeeded", "executing")).toBe(false);
  });
});
