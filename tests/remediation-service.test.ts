import { beforeEach, describe, expect, it } from "vitest";
import { RemediationService, proposeRemediationSchema } from "@/server/services/remediation-service";
import { RuleBasedPolicyEngine } from "@/server/core/domain/policy";
import { SimulatedRemediationProvider } from "@/server/adapters/simulated/remediation-provider";
import type { RemediationProvider } from "@/server/core/ports/remediation-provider";
import { DeploymentService } from "@/server/services/deployment-service";
import { resetRepos } from "@/server/repositories/store";
import { NotFoundError, PolicyBlockedError } from "@/server/core/errors";
import { SimulatedChainProvider } from "@/server/adapters/simulated/chain-provider";

function makeService(provider?: RemediationProvider) {
  const deployments = new DeploymentService();
  return new RemediationService(new RuleBasedPolicyEngine(), provider ?? new SimulatedRemediationProvider(deployments, new SimulatedChainProvider()), deployments);
}

describe("RemediationService", () => {
  beforeEach(() => resetRepos());

  it("rejects disallowed types, malformed AI-like fields, and invalid targets", () => {
    expect(proposeRemediationSchema.safeParse({ type: "shell", targetId: "x", reason: "run this command" }).success).toBe(false);
    expect(proposeRemediationSchema.safeParse({ type: "service-restart", targetId: "svc-api-gateway", reason: "Restart safely", command: "rm -rf" }).success).toBe(false);
    expect(() => makeService().propose({ type: "service-restart", targetId: "missing", reason: "Restart the target" }, "usr-adrian")).toThrowError(NotFoundError);
    expect(new RuleBasedPolicyEngine().evaluate("service-restart", "viewer").allowed).toBe(false);
  });

  it("requires explicit approval and role authorization for high-risk execution", () => {
    const service = makeService();
    const proposal = service.propose({ type: "deployment-rollback", targetId: "DEP-1039", reason: "Failed release requires recovery" }, "usr-jonas");
    expect(() => service.execute(proposal.businessId, "usr-adrian")).toThrowError(PolicyBlockedError);
    expect(() => service.approve(proposal.businessId, "usr-jonas")).toThrowError(PolicyBlockedError);
    expect(service.approve(proposal.businessId, "usr-adrian").status).toBe("approved");
  });

  it("executes an approved low-risk simulation and records every audit step", () => {
    const service = makeService();
    const proposal = service.propose({ type: "service-restart", targetId: "svc-api-gateway", reason: "Recover a stuck service" }, "usr-jonas");
    service.approve(proposal.businessId, "usr-jonas");
    const result = service.execute(proposal.businessId, "usr-jonas");
    expect(result.status).toBe("succeeded");
    expect(result.auditEvents.map((event) => event.kind)).toEqual(["proposed", "approved", "execution-started", "execution-succeeded"]);
    expect(result.result).toContain("no runtime or infrastructure state was changed");
  });

  it("fails closed on provider failure and records the failure", () => {
    const provider: RemediationProvider = { name: "failing demo provider", isDemo: true, execute: () => { throw new Error("verification failed"); } };
    const service = makeService(provider);
    const proposal = service.propose({ type: "service-restart", targetId: "svc-api-gateway", reason: "Recover a stuck service" }, "usr-jonas");
    service.approve(proposal.businessId, "usr-jonas");
    const failed = service.execute(proposal.businessId, "usr-jonas");
    expect(failed.status).toBe("failed");
    expect(failed.auditEvents.at(-1)?.kind).toBe("execution-failed");
  });

  it("verifies RPC failover and redistributes traffic only to healthy peers", () => {
    const service = makeService();
    const proposal = service.propose({ type: "rpc-failover", targetId: "rpc-base-b", reason: "Provider B is degraded" }, "usr-jonas");
    service.approve(proposal.businessId, "usr-priya");
    const result = service.execute(proposal.businessId, "usr-priya");
    expect(result.status).toBe("succeeded");
    expect(result.result).toContain("traffic redistributed");
    expect(service.list()).toHaveLength(1);
  });
});
