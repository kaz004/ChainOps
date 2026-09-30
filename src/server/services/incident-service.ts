import type { Alert, Deployment, Incident, IncidentEvent, IncidentStatus, LogEntry, PipelineRun, TelemetryMetric, Trace } from "@/types/domain";
import { getRepos } from "@/server/repositories/store";
import { NotFoundError, InvalidTransitionError } from "@/server/core/errors";
import {
  canTransitionIncident,
  INCIDENT_TRANSITIONS,
  isIncidentActive,
} from "@/server/core/domain/state-machines";
import { nextBusinessId } from "@/server/core/domain/ids";
import type { SloService } from "@/server/services/slo-service";
import type { TelemetryService } from "@/server/services/telemetry-service";
import { telemetryQuerySchema } from "@/server/services/telemetry-service";
import { z } from "zod";

export const incidentListQuerySchema = z.object({
  status: z.enum(["detected", "investigating", "mitigating", "monitoring", "resolved"]).optional(),
  severity: z.enum(["sev-1", "sev-2", "sev-3", "sev-4"]).optional(),
  q: z.string().max(120).default(""),
});

export interface IncidentDetail extends Incident {
  events: IncidentEvent[];
  serviceNames: string[];
  alerts: Alert[];
  relatedDeployments: Deployment[];
  relatedPipelines: PipelineRun[];
  sloIds: string[];
  telemetry: { metrics: TelemetryMetric[]; logs: LogEntry[]; traces: Trace[] };
  allowedTransitions: IncidentStatus[];
}

export class IncidentService {
  constructor(private readonly slos?: Pick<SloService, "listWithBudgets">, private readonly telemetry?: TelemetryService) {}

  listAlerts(): Alert[] {
    return getRepos().alerts.all().sort((a, b) => b.firstFiredAt.localeCompare(a.firstFiredAt));
  }

  list(): Incident[] {
    const repos = getRepos();
    return [...repos.incidents.all()].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  search(filters: z.output<typeof incidentListQuerySchema>): Incident[] {
    const query = filters.q.trim().toLowerCase();
    return this.list().filter((incident) =>
      (!filters.status || incident.status === filters.status) &&
      (!filters.severity || incident.severity === filters.severity) &&
      (!query || `${incident.title} ${incident.businessId} ${incident.summary}`.toLowerCase().includes(query)),
    );
  }

  get(idOrBusinessId: string): Incident {
    const repos = getRepos();
    const found =
      repos.incidents.get(idOrBusinessId) ??
      repos.incidents.all().find((i) => i.businessId === idOrBusinessId);
    if (!found) throw new NotFoundError("Incident", idOrBusinessId);
    return found;
  }

  detail(idOrBusinessId: string): IncidentDetail {
    const repos = getRepos();
    const incident = this.get(idOrBusinessId);
    const events = [...repos.incidentEvents.all()]
      .filter((e) => e.incidentId === incident.id)
      .sort((a, b) => a.at.localeCompare(b.at));
    const serviceNames = incident.serviceIds
      .map((sid) => repos.services.get(sid)?.name ?? sid)
      .filter((n) => Boolean(n));
    const serviceIds = new Set(incident.serviceIds);
    const telemetry = this.telemetry?.getExplorer(telemetryQuerySchema.parse({ pageSize: 50 }));
    return {
      ...incident, events, serviceNames,
      alerts: repos.alerts.all().filter((alert) => alert.incidentId === incident.id),
      relatedDeployments: repos.deployments.all().filter((d) => serviceIds.has(d.serviceId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
      relatedPipelines: repos.pipelineRuns.all().filter((run) => serviceIds.has(run.serviceId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
      sloIds: repos.slos.all().filter((slo) => serviceIds.has(slo.serviceId)).map((slo) => slo.id),
      telemetry: {
        metrics: telemetry?.metrics.filter((m) => serviceIds.has(m.serviceId)) ?? [],
        logs: telemetry?.logs.filter((log) => serviceIds.has(log.serviceId)) ?? [],
        traces: telemetry?.traces.filter((trace) => serviceIds.has(trace.serviceId)) ?? [],
      },
      allowedTransitions: [...INCIDENT_TRANSITIONS[incident.status]],
    };
  }

  detectFromSignals(): { alerts: Alert[]; incidents: Incident[] } {
    if (!this.slos) return { alerts: [], incidents: [] };
    const repos = getRepos();
    const alerts: Alert[] = [];
    const incidents: Incident[] = [];
    for (const slo of this.slos.listWithBudgets()) {
      if (slo.status === "healthy" || slo.sli.observedPct === null) continue;
      if (repos.alerts.all().some((a) => a.status === "firing" && a.sloId === slo.id)) continue;
      const activeIncident = repos.incidents.all().find((i) => isIncidentActive(i.status) && i.serviceIds.includes(slo.serviceId));
      const businessId = nextBusinessId("ALT");
      const now = new Date().toISOString();
      const alert: Alert = {
        id: businessId.toLowerCase(), businessId, title: `${slo.serviceName} ${slo.kind} objective ${slo.status}`,
        severity: slo.status === "breached" ? "sev-1" : "sev-2", status: "firing", source: "slo",
        serviceId: slo.serviceId, sloId: slo.id, incidentId: activeIncident?.id ?? null,
        metric: slo.kind, observedValue: slo.sli.observedPct, threshold: slo.targetPct,
        firstFiredAt: now, resolvedAt: null,
      };
      repos.alerts.insert(alert);
      alerts.push(alert);
      if (activeIncident) {
        repos.incidentEvents.insert({ id: `iev-${crypto.randomUUID()}`, incidentId: activeIncident.id, at: now, kind: "alert", message: `${businessId} correlated to this incident.`, actor: "system" });
        continue;
      }
      const service = repos.services.get(slo.serviceId);
      if (!service) continue;
      const incidentBusinessId = nextBusinessId("INC");
      const incident: Incident = {
        id: incidentBusinessId.toLowerCase(), businessId: incidentBusinessId,
        title: `${service.name} ${slo.kind} objective breached`, severity: alert.severity, status: "detected",
        serviceIds: [service.id], affectedProjectIds: [service.projectId], detectedAt: now, resolvedAt: null,
        summary: `Telemetry reports ${slo.sli.observedPct}% against a ${slo.targetPct}% objective.`,
        impact: `${service.name} is outside its ${slo.kind} service objective.`,
      };
      alert.incidentId = incident.id;
      repos.alerts.save(alert);
      repos.incidents.insert(incident);
      repos.incidentEvents.insert({ id: `iev-${crypto.randomUUID()}`, incidentId: incident.id, at: now, kind: "detection", message: `Created from ${businessId} using simulated SLO telemetry.`, actor: "system" });
      repos.activity.append({ id: `act-${crypto.randomUUID()}`, at: now, kind: "incident", title: "Incident detected", detail: incident.title, refType: "incident", refId: incident.businessId, actor: "system" });
      incidents.push(incident);
    }
    return { alerts, incidents };
  }

  createFromChaosSignal(serviceId: string, experiment: string, observedValue: number, runId: string): Incident {
    const repos = getRepos();
    const service = repos.services.get(serviceId);
    if (!service) throw new NotFoundError("Service", serviceId);
    const active = repos.incidents.all().find((item) => isIncidentActive(item.status) && item.serviceIds.includes(serviceId));
    const now = new Date().toISOString();
    if (active) {
      repos.incidentEvents.insert({ id: `iev-${crypto.randomUUID()}`, incidentId: active.id, at: now, kind: "alert", message: `Chaos run ${runId} promoted as evidence: ${experiment}.`, actor: "system" });
      return active;
    }
    const incidentBusinessId = nextBusinessId("INC");
    const incident: Incident = {
      id: incidentBusinessId.toLowerCase(), businessId: incidentBusinessId,
      title: `Simulated ${experiment} on ${service.name}`, severity: "sev-2", status: "detected",
      serviceIds: [service.id], affectedProjectIds: [service.projectId], detectedAt: now, resolvedAt: null,
      summary: `Chaos run ${runId} produced a measured signal value of ${observedValue.toFixed(2)}.`,
      impact: `The simulated ${experiment} affected ${service.name}. No real infrastructure was changed.`,
    };
    const alertBusinessId = nextBusinessId("ALT");
    repos.alerts.insert({
      id: alertBusinessId.toLowerCase(), businessId: alertBusinessId, title: `Chaos signal: ${experiment}`,
      severity: "sev-2", status: "firing", source: "telemetry", serviceId, sloId: null,
      incidentId: incident.id, metric: experiment, observedValue, threshold: 0,
      firstFiredAt: now, resolvedAt: null,
    });
    repos.incidents.insert(incident);
    repos.incidentEvents.insert({ id: `iev-${crypto.randomUUID()}`, incidentId: incident.id, at: now, kind: "detection", message: `Promoted from simulated chaos run ${runId}.`, actor: "system" });
    repos.activity.append({ id: `act-${crypto.randomUUID()}`, at: now, kind: "incident", title: "Incident created from chaos run", detail: incident.businessId, refType: "incident", refId: incident.businessId, actor: "system" });
    return incident;
  }

  transition(idOrBusinessId: string, to: IncidentStatus, actor: string = "system"): Incident {
    const repos = getRepos();
    const incident = this.get(idOrBusinessId);
    if (!canTransitionIncident(incident.status, to)) {
      throw new InvalidTransitionError(
        `Incident ${incident.businessId} cannot transition ${incident.status} → ${to}`,
      );
    }

    const prev = incident.status;
    incident.status = to;
    if (to === "resolved" && prev !== "resolved") {
      incident.resolvedAt = new Date().toISOString();
    }
    repos.incidents.save(incident);

    repos.incidentEvents.insert({
      id: `iev-${crypto.randomUUID()}`,
      incidentId: incident.id,
      at: new Date().toISOString(),
      kind: "status-change",
      message: `Status changed ${prev} → ${to}`,
      actor,
    });
    if (to === "resolved") {
      const at = incident.resolvedAt ?? new Date().toISOString();
      for (const alert of repos.alerts.all().filter((item) => item.incidentId === incident.id && item.status === "firing")) {
        alert.status = "resolved";
        alert.resolvedAt = at;
        repos.alerts.save(alert);
      }
      repos.incidentEvents.insert({ id: `iev-${crypto.randomUUID()}`, incidentId: incident.id, at, kind: "resolution", message: "Linked firing alerts resolved with the incident.", actor });
    }
    repos.activity.append({ id: `act-${crypto.randomUUID()}`, at: new Date().toISOString(), kind: "incident", title: `Incident ${to}`, detail: incident.businessId, refType: "incident", refId: incident.businessId, actor });

    return incident;
  }

  isActive(i: Incident): boolean {
    return isIncidentActive(i.status);
  }
}
