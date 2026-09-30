import { beforeEach, describe, expect, it } from "vitest";
import { SimulatedChainProvider } from "@/server/adapters/simulated/chain-provider";
import { SimulatedTelemetryProvider } from "@/server/adapters/simulated/telemetry-provider";
import { SimulatedRemediationProvider } from "@/server/adapters/simulated/remediation-provider";
import { RuleBasedPolicyEngine } from "@/server/core/domain/policy";
import { getSimulationEngine } from "@/server/core/simulation/singleton";
import { resetRepos, getRepos } from "@/server/repositories/store";
import { ChainService } from "@/server/services/chain-service";
import { DeploymentService } from "@/server/services/deployment-service";
import { IncidentService } from "@/server/services/incident-service";
import { RemediationService } from "@/server/services/remediation-service";
import { SloService } from "@/server/services/slo-service";
import { TelemetryService } from "@/server/services/telemetry-service";
import { AIService } from "@/server/services/ai-service";
import { MockAIProvider } from "@/server/adapters/simulated/ai-provider";

describe("multichain RPC recovery loop", () => {
  beforeEach(() => {
    resetRepos();
    const engine = getSimulationEngine();
    engine.clearRpcFailure("rpc-base-b");
    engine.injectRpcFailure("rpc-base-b");
  });

  it("correlates RPC degradation through RCA and approved failover to recovery and resolution", () => {
    const chains = new SimulatedChainProvider();
    const telemetryProvider = new SimulatedTelemetryProvider(chains);
    const telemetry = new TelemetryService(telemetryProvider);
    const slos = new SloService(telemetryProvider);
    const deployments = new DeploymentService();
    const incidents = new IncidentService(slos, telemetry);
    const chainService = new ChainService(chains);
    const ai = new AIService(incidents, deployments, slos, chainService, new MockAIProvider());
    const remediation = new RemediationService(new RuleBasedPolicyEngine(), new SimulatedRemediationProvider(deployments, chains), deployments);

    expect(chains.get("base")?.rpcErrorRatePct).toBe(11.4);
    expect(slos.listWithBudgets().find((slo) => slo.businessId === "SLO-4002")?.status).toBe("breached");
    expect(getRepos().alerts.get("alt-142")?.incidentId).toBe("inc-142");
    expect(telemetryProvider.read({ from: Date.now() - 15 * 60_000, to: Date.now() }).metrics.find((metric) => metric.serviceId === "svc-checkout-api" && metric.kind === "error-rate")?.points.some((point) => point.v > 1)).toBe(true);
    expect(ai.analyzeIncident("INC-142").likelyCause).toContain("RPC provider");

    const proposal = remediation.propose({ type: "rpc-failover", targetId: "rpc-base-b", reason: "Base RPC errors are elevated" }, "usr-jonas");
    remediation.approve(proposal.businessId, "usr-priya");
    expect(remediation.execute(proposal.businessId, "usr-priya").status).toBe("succeeded");
    expect(chains.get("base")?.status).toBe("healthy");
    expect(slos.listWithBudgets().find((slo) => slo.businessId === "SLO-4002")?.status).toBe("healthy");
    expect(getRepos().rpcProviders.get("rpc-base-a")?.trafficWeightPct).toBeCloseTo(87.5);
    expect(telemetryProvider.read({ from: Date.now() - 15 * 60_000, to: Date.now() }).metrics.find((metric) => metric.serviceId === "svc-checkout-api" && metric.kind === "error-rate")?.points.every((point) => point.v < 1)).toBe(true);

    for (const status of ["mitigating", "monitoring", "resolved"] as const) incidents.transition("INC-142", status, "Mira Chen");
    expect(getRepos().alerts.get("alt-142")?.status).toBe("resolved");
    expect(ai.incidentBundle("INC-142").postmortem?.source).toBe("demo-ai");
  });
});
