import { beforeEach, describe, expect, it } from "vitest";
import { ChaosService } from "@/server/services/chaos-service";
import { IncidentService } from "@/server/services/incident-service";
import { SloService } from "@/server/services/slo-service";
import { TelemetryService } from "@/server/services/telemetry-service";
import { getSimulationEngine } from "@/server/core/simulation/singleton";
import { SimulationEngine } from "@/server/core/simulation/engine";
import { resetRepos } from "@/server/repositories/store";
import { PolicyBlockedError } from "@/server/core/errors";
import { SimulatedTelemetryProvider } from "@/server/adapters/simulated/telemetry-provider";
import { SimulatedChainProvider } from "@/server/adapters/simulated/chain-provider";

describe("ChaosService", () => {
  beforeEach(() => {
    resetRepos();
    getSimulationEngine().clearChaos("chaos-1001");
    getSimulationEngine().clearChaos("chaos-1002");
  });

  it("automatically clears expired effects on telemetry reads", () => {
    const engine = new SimulationEngine();
    expect(engine.applyChaos("expired", "cpu-stress", ["svc-test"], 3, Date.now() - 1)).toBe(true);
    expect(engine.chaosModifiers("svc-test").cpuMultiplier).toBe(1);
  });

  it("requires production confirmation and abort restores shared telemetry modifiers", () => {
    const provider = new SimulatedTelemetryProvider(new SimulatedChainProvider());
    const sloService = new SloService(provider);
    const incidentService = new IncidentService(sloService, new TelemetryService(provider));
    const chaos = new ChaosService(incidentService);
    const input = { type: "rpc-failure" as const, targetServiceId: "svc-api-gateway", durationSeconds: 30, intensity: 2, productionConfirmed: false };
    expect(() => chaos.start(input)).toThrowError(PolicyBlockedError);
    const run = chaos.start({ ...input, productionConfirmed: true });
    expect(run.blastRadiusServiceIds.length).toBeGreaterThan(1);
    expect(getSimulationEngine().chaosModifiers("svc-api-gateway").errorRateMultiplier).toBe(50);
    expect(sloService.listWithBudgets().find((slo) => slo.serviceId === "svc-api-gateway")?.status).toBe("breached");
    expect(incidentService.detectFromSignals().incidents.some((incident) => incident.serviceIds.includes("svc-api-gateway"))).toBe(true);
    expect(chaos.abort(run.businessId).status).toBe("aborted");
    expect(getSimulationEngine().chaosModifiers("svc-api-gateway").errorRateMultiplier).toBe(1);
  });

  it("promotes a bounded run to a correlated incident", () => {
    const provider = new SimulatedTelemetryProvider(new SimulatedChainProvider());
    const incidentService = new IncidentService(new SloService(provider), new TelemetryService(provider));
    const chaos = new ChaosService(incidentService);
    const run = chaos.start({ type: "cpu-stress", targetServiceId: "svc-api-gateway", durationSeconds: 30, intensity: 4, productionConfirmed: true });
    const promoted = chaos.promoteToIncident(run.businessId);
    expect(promoted.incidentId).not.toBeNull();
    expect(incidentService.get(promoted.incidentId!).serviceIds).toContain(run.targetServiceId);
    chaos.abort(run.businessId);
  });
});
