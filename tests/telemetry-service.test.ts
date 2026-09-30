import { describe, expect, it } from "vitest";
import { telemetryQuerySchema, TelemetryService } from "@/server/services/telemetry-service";
import { SimulatedTelemetryProvider } from "@/server/adapters/simulated/telemetry-provider";
import { SimulatedChainProvider } from "@/server/adapters/simulated/chain-provider";

describe("TelemetryService", () => {
  it("returns deterministic bounded metric samples and correlated log/trace identifiers", () => {
    const service = new TelemetryService(new SimulatedTelemetryProvider(new SimulatedChainProvider()));
    const filters = telemetryQuerySchema.parse({ range: "1h" });
    const first = service.getExplorer(filters);
    const second = service.getExplorer(filters);
    expect(first.source).toBe("demo-telemetry");
    expect(first.metrics[0]?.points).toEqual(second.metrics[0]?.points);
    expect(first.logs.length).toBeLessThanOrEqual(filters.pageSize);
    expect(first.logs[0]?.traceId).toBe(first.traces[0]?.traceId);
    expect(first.logs[0]?.spanId).toBe(first.traces[0]?.spans[0]?.spanId);
  });

  it("applies service, severity, search and page size filters", () => {
    const service = new TelemetryService(new SimulatedTelemetryProvider(new SimulatedChainProvider()));
    const all = service.getExplorer(telemetryQuerySchema.parse({}));
    const filtered = service.getExplorer(telemetryQuerySchema.parse({ serviceId: all.health[0]?.serviceId, severity: "error", pageSize: 5 }));
    expect(filtered.health).toHaveLength(1);
    expect(filtered.logs.every((log) => log.level === "error")).toBe(true);
    expect(filtered.logs.length).toBeLessThanOrEqual(5);
    expect(() => telemetryQuerySchema.parse({ pageSize: 1000 })).toThrow();
  });
});
