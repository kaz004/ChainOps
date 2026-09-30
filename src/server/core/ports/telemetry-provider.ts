import type { LogEntry, ServiceHealthSnapshot, TelemetryMetric, Trace } from "@/types/domain";

export interface TelemetryQuery {
  serviceId?: string;
  from: number;
  to: number;
}

export interface TelemetrySnapshot {
  metrics: TelemetryMetric[];
  logs: LogEntry[];
  traces: Trace[];
  health: ServiceHealthSnapshot[];
}

export interface TelemetryProvider {
  readonly name: string;
  readonly isDemo: boolean;
  read(query: TelemetryQuery): TelemetrySnapshot;
}
