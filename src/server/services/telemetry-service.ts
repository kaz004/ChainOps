import { z } from "zod";
import type { LogEntry } from "@/types/domain";
import type { TelemetryProvider } from "@/server/core/ports/telemetry-provider";
import { getRepos } from "@/server/repositories/store";

export const telemetryQuerySchema = z.object({
  serviceId: z.string().optional(),
  severity: z.enum(["all", "info", "warn", "error"]).default("all"),
  q: z.string().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
  range: z.enum(["15m", "1h", "6h"]).default("1h"),
});

export type TelemetryFilters = z.output<typeof telemetryQuerySchema>;

export class TelemetryService {
  constructor(private readonly provider: TelemetryProvider) {}

  getExplorer(filters: TelemetryFilters) {
    const to = Date.now();
    const from = to - ({ "15m": 15, "1h": 60, "6h": 360 }[filters.range] * 60_000);
    const data = this.provider.read({ from, to, serviceId: filters.serviceId });
    const query = filters.q.trim().toLowerCase();
    const matching = (entry: LogEntry) => (filters.severity === "all" || entry.level === filters.severity) &&
      (!query || `${entry.message} ${entry.serviceName} ${entry.traceId}`.toLowerCase().includes(query));
    const logs = data.logs.filter(matching).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const traces = data.traces.filter((trace) => !query || `${trace.traceId} ${trace.serviceName}`.toLowerCase().includes(query))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const start = (filters.page - 1) * filters.pageSize;
    return {
      source: "demo-telemetry" as const,
      provider: this.provider.name,
      services: getRepos().services.all(),
      health: data.health,
      metrics: data.metrics,
      logs: logs.slice(start, start + filters.pageSize),
      logCount: logs.length,
      page: filters.page,
      pageSize: filters.pageSize,
      traces: traces.slice(0, 8),
      traceCount: traces.length,
    };
  }
}
