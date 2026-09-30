import type { LogEntry, MetricKind, ServiceHealthSnapshot, TelemetryMetric, Trace } from "@/types/domain";
import { getSimulationEngine } from "@/server/core/simulation/singleton";
import { DEFAULT_PROFILE, sampleNow, type SeriesKind } from "@/server/core/simulation/sample";
import { getRepos } from "@/server/repositories/store";
import type { TelemetryProvider, TelemetryQuery, TelemetrySnapshot } from "@/server/core/ports/telemetry-provider";
import type { ChainProvider } from "@/server/core/ports/chain-provider";

const series: { kind: MetricKind; sample: SeriesKind; unit: string }[] = [
  { kind: "request-rate", sample: "request-rate", unit: "req/min" },
  { kind: "error-rate", sample: "error-rate", unit: "%" },
  { kind: "latency-p95", sample: "latency-p95", unit: "ms" },
  { kind: "cpu", sample: "cpu", unit: "%" },
  { kind: "memory", sample: "memory", unit: "%" },
];

export class SimulatedTelemetryProvider implements TelemetryProvider {
  readonly name = "SimulationEngine telemetry adapter";
  readonly isDemo = true;

  constructor(private readonly chains: ChainProvider) {}

  read(query: TelemetryQuery): TelemetrySnapshot {
    const repos = getRepos();
    const services = repos.services.all().filter((s) => !query.serviceId || s.id === query.serviceId);
    const engine = getSimulationEngine();
    const degradedChainIds = new Set(this.chains.list().filter((chain) => chain.status !== "healthy").map((chain) => chain.id));
    const chainAffectsService = (serviceId: string, projectId: string) => {
      const project = repos.projects.getById(projectId);
      return project?.serviceIds.includes(serviceId) === true && project.chainIds.some((chainId) => degradedChainIds.has(chainId));
    };
    const sampleEnd = Math.floor(query.to / 300_000) * 300_000;
    const sampleCount = Math.min(73, Math.ceil((query.to - query.from) / 300_000) + 1);
    const spanTraces: Trace[] = services.flatMap((service, serviceIndex) => {
      const traceId = `tr-${service.id.slice(-6)}-${Math.floor(sampleEnd / 300_000)}`;
      const chainAffected = chainAffectsService(service.id, service.projectId);
      const chaos = engine.chaosModifiers(service.id);
      const affected = chainAffected || chaos.errorRateMultiplier > 1;
      const duration = Math.round(sampleNow(service.id, "latency-p95", DEFAULT_PROFILE, {
        errorRateMultiplier: (chainAffected ? 600 : 1) * chaos.errorRateMultiplier,
        latencyMultiplier: (chainAffected ? 8 : 1) * chaos.latencyMultiplier,
      }, sampleEnd));
      const dependency = services[(serviceIndex + 1) % Math.max(services.length, 1)];
      const spans = [
        { spanId: `${traceId}-root`, parentSpanId: null, serviceId: service.id, serviceName: service.name, operation: "HTTP GET /api/checkout", startTime: new Date(sampleEnd - duration).toISOString(), durationMs: Math.max(1, duration - 9), status: affected ? "error" as const : "ok" as const },
        { spanId: `${traceId}-rpc`, parentSpanId: `${traceId}-root`, serviceId: dependency?.id ?? service.id, serviceName: dependency?.name ?? service.name, operation: "RPC eth_call", startTime: new Date(sampleEnd - Math.max(1, duration - 20)).toISOString(), durationMs: chainAffected ? Math.max(12, duration - 15) : 12, status: chainAffected ? "error" as const : "ok" as const },
        { spanId: `${traceId}-db`, parentSpanId: `${traceId}-root`, serviceId: service.id, serviceName: service.name, operation: "database.query", startTime: new Date(sampleEnd - 8).toISOString(), durationMs: 6, status: "ok" as const },
      ];
      return [{ traceId, serviceId: service.id, serviceName: service.name, projectId: service.projectId, startedAt: new Date(sampleEnd - duration).toISOString(), durationMs: duration, status: affected ? "error" : "ok", spans }];
    });
    const metrics: TelemetryMetric[] = services.flatMap((service) => {
      const affected = chainAffectsService(service.id, service.projectId);
      const chaos = engine.chaosModifiers(service.id);
      const failure = {
        errorRateMultiplier: (affected ? 600 : 1) * chaos.errorRateMultiplier,
        latencyMultiplier: (affected ? 8 : 1) * chaos.latencyMultiplier,
      };
      const profile = {
        ...DEFAULT_PROFILE,
        requestRatePerMin: DEFAULT_PROFILE.requestRatePerMin * chaos.requestRateMultiplier,
        cpuPct: DEFAULT_PROFILE.cpuPct * chaos.cpuMultiplier,
        memoryPct: DEFAULT_PROFILE.memoryPct * chaos.memoryMultiplier,
      };
      return series.map((metric) => ({
        serviceId: service.id,
        serviceName: service.name,
        kind: metric.kind,
        unit: metric.unit,
        points: Array.from({ length: sampleCount }, (_, index) => {
          const timestamp = sampleEnd - (sampleCount - 1 - index) * 300_000;
          const value = sampleNow(service.id, metric.sample, profile, failure, timestamp);
          return { t: new Date(timestamp).toISOString(), v: metric.kind === "error-rate" || metric.kind === "cpu" || metric.kind === "memory" ? Math.min(100, value) : value };
        }).filter((point) => Date.parse(point.t) >= query.from),
      }));
    });
    const health: ServiceHealthSnapshot[] = services.map((service) => engine.serviceSnapshot(service.id, service.name, service.projectId, {
      affectedByIncident: chainAffectsService(service.id, service.projectId),
    }));
    const logs: LogEntry[] = spanTraces.map((trace) => ({
      id: `log-${trace.traceId}`,
      timestamp: trace.startedAt,
      level: trace.status === "error" ? "error" : "info",
      serviceId: trace.serviceId,
      serviceName: trace.serviceName,
      traceId: trace.traceId,
      spanId: trace.spans[0]!.spanId,
      message: trace.status === "error" ? "Request completed with elevated latency during a simulated fault" : "Request completed successfully",
      attributes: { route: "/api/checkout", durationMs: String(trace.durationMs), environment: "production" },
    }));
    return { metrics, logs, traces: spanTraces, health };
  }
}
