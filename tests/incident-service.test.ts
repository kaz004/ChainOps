import { beforeEach, describe, expect, it } from "vitest";
import { IncidentService } from "@/server/services/incident-service";
import { TelemetryService } from "@/server/services/telemetry-service";
import { resetRepos } from "@/server/repositories/store";
import { InvalidTransitionError } from "@/server/core/errors";
import type { SloWithBudget } from "@/server/services/slo-service";
import { SimulatedTelemetryProvider } from "@/server/adapters/simulated/telemetry-provider";
import { SimulatedChainProvider } from "@/server/adapters/simulated/chain-provider";

describe("IncidentService", () => {
  beforeEach(() => resetRepos());

  it("correlates seed incident to its alert, SLO, deployments, and sampled telemetry", () => {
    const service = new IncidentService(undefined, new TelemetryService(new SimulatedTelemetryProvider(new SimulatedChainProvider())));
    const detail = service.detail("INC-142");
    expect(detail.alerts.some((alert) => alert.businessId === "ALT-142")).toBe(true);
    expect(detail.sloIds).toContain("slo-4002");
    expect(detail.relatedDeployments.length).toBeGreaterThan(0);
    expect(detail.telemetry.metrics.some((metric) => metric.serviceId === "svc-checkout-api")).toBe(true);
    expect(detail.telemetry.logs.every((log) => detail.serviceIds.includes(log.serviceId))).toBe(true);
  });

  it("generates a deduplicated alert and incident from an SLO signal", () => {
    const signal: SloWithBudget = {
      id: "slo-new", businessId: "SLO-NEW", serviceId: "svc-api-gateway", serviceName: "api-gateway",
      kind: "availability" as const, targetPct: 99.9, windowDays: 30 as const, description: "Gateway success",
      budget: { sloId: "slo-new", targetPct: 99.9, currentPct: 98, remainingPct: 0, consumedPct: 100, burnRate1h: 20, burnRate6h: 10, projectedExhaustionAt: null },
      sli: { observedPct: 98, requestVolume: 1000, sampleCount: 12, window: "observed" as const }, status: "breached" as const,
    };
    const service = new IncidentService({ listWithBudgets: () => [signal] });
    const first = service.detectFromSignals();
    expect(first.alerts).toHaveLength(1);
    expect(first.incidents).toHaveLength(1);
    expect(first.alerts[0]?.incidentId).toBe(first.incidents[0]?.id);
    expect(service.detectFromSignals().alerts).toHaveLength(0);
  });

  it("enforces transitions and resolves linked alerts when the incident resolves", () => {
    const service = new IncidentService();
    expect(() => service.transition("INC-142", "detected")).toThrowError(InvalidTransitionError);
    service.transition("INC-142", "mitigating");
    service.transition("INC-142", "monitoring");
    service.transition("INC-142", "resolved");
    expect(service.listAlerts().find((alert) => alert.businessId === "ALT-142")?.status).toBe("resolved");
    expect(service.detail("INC-142").events.some((event) => event.kind === "resolution")).toBe(true);
  });
});
