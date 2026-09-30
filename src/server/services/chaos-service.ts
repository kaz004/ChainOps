import { z } from "zod";
import type { ChaosExperimentType, ChaosRun } from "@/types/domain";
import { CHAOS_EXPERIMENT_TYPES } from "@/types/domain";
import { ConflictError, InvalidTransitionError, NotFoundError, PolicyBlockedError, ValidationError } from "@/server/core/errors";
import { nextBusinessId } from "@/server/core/domain/ids";
import { canTransitionChaosRun } from "@/server/core/domain/state-machines";
import { getSimulationEngine } from "@/server/core/simulation/singleton";
import { chainTouchingServiceIds } from "@/server/seed/demo-data";
import { getRepos } from "@/server/repositories/store";
import type { IncidentService } from "@/server/services/incident-service";

export const startChaosSchema = z.object({
  type: z.enum(CHAOS_EXPERIMENT_TYPES),
  targetServiceId: z.string().min(1),
  durationSeconds: z.number().int().min(10).max(120),
  intensity: z.number().int().min(1).max(5),
  productionConfirmed: z.boolean(),
});
export type StartChaosInput = z.infer<typeof startChaosSchema>;

const impactDescriptions: Record<ChaosExperimentType, string> = {
  "pod-failure": "Elevated service errors and latency",
  "rpc-failure": "Elevated RPC errors and latency across chain-dependent services",
  "network-latency": "Increased request latency",
  "packet-loss": "Increased request errors and latency",
  "cpu-stress": "Increased CPU utilization",
  "memory-pressure": "Increased memory utilization",
  "db-failure": "Elevated database-dependent errors and latency",
  "traffic-spike": "Increased request rate and CPU utilization",
  "deployment-regression": "Elevated errors and latency after simulated regression",
};

export class ChaosService {
  constructor(private readonly incidents: IncidentService) {}

  list(): ChaosRun[] {
    const repos = getRepos();
    return repos.chaosRuns.all().sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map((run) => this.settle(run));
  }

  get(id: string): ChaosRun {
    const run = getRepos().chaosRuns.get(id) ?? getRepos().chaosRuns.all().find((item) => item.businessId === id);
    if (!run) throw new NotFoundError("Chaos run", id);
    return this.settle(run);
  }

  start(input: StartChaosInput): ChaosRun {
    const repos = getRepos();
    if (this.list().some((run) => run.status === "running")) throw new ConflictError("Only one chaos run may be active at a time.");
    const service = repos.services.get(input.targetServiceId);
    if (!service) throw new NotFoundError("Service", input.targetServiceId);
    if (service.environment === "production" && !input.productionConfirmed) {
      throw new PolicyBlockedError("Production chaos requires explicit confirmation. This run remains simulated and cannot affect real infrastructure.");
    }
    const project = repos.projects.getById(service.projectId);
    if (!project || project.status !== "active") throw new ValidationError("Archived or missing projects cannot be chaos targets.");
    const blastRadiusServiceIds = input.type === "rpc-failure"
      ? repos.services.all().filter((candidate) => chainTouchingServiceIds.has(candidate.id)).map((candidate) => candidate.id)
      : [service.id];
    const businessId = nextBusinessId("CHAOS");
    const id = businessId.toLowerCase();
    const now = Date.now();
    if (!getSimulationEngine().applyChaos(id, input.type, blastRadiusServiceIds, input.intensity, now + input.durationSeconds * 1000)) {
      throw new ConflictError("A target in this blast radius already has an active simulated failure.");
    }
    const run: ChaosRun = {
      id, businessId, type: input.type, targetServiceId: service.id, targetServiceName: service.name,
      durationSeconds: input.durationSeconds, intensity: input.intensity, blastRadiusServiceIds,
      expectedImpact: impactDescriptions[input.type], status: "running", startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + input.durationSeconds * 1000).toISOString(), completedAt: null,
      result: null, incidentId: null,
    };
    repos.chaosRuns.insert(run);
    repos.activity.append({ id: `act-${crypto.randomUUID()}`, at: run.startedAt, kind: "chaos", title: "Simulated chaos run started", detail: `${run.businessId}: ${run.type} on ${service.name}`, refType: null, refId: null, actor: "Adrian Vale" });
    return run;
  }

  abort(id: string): ChaosRun {
    const run = this.get(id);
    if (!canTransitionChaosRun(run.status, "aborted")) throw new InvalidTransitionError(`Chaos run ${run.businessId} cannot be aborted from ${run.status}.`);
    this.finish(run, "aborted", "Aborted by operator; simulated fault cleared and telemetry returned to baseline.");
    return run;
  }

  promoteToIncident(id: string): ChaosRun {
    const run = this.get(id);
    if (run.status !== "running" && run.status !== "completed") throw new InvalidTransitionError("Only running or completed chaos runs can be promoted.");
    const incident = this.incidents.detectFromSignals().incidents.find((item) => item.serviceIds.includes(run.targetServiceId))
      ?? this.incidents.createFromChaosSignal(run.targetServiceId, run.type, run.intensity, run.businessId);
    run.incidentId = incident.id;
    getRepos().chaosRuns.save(run);
    return run;
  }

  private settle(run: ChaosRun): ChaosRun {
    if (run.status === "running" && Date.now() >= Date.parse(run.endsAt)) {
      this.finish(run, "completed", `${run.expectedImpact}. Duration elapsed; simulated fault cleared.`);
    }
    return run;
  }

  private finish(run: ChaosRun, status: "completed" | "aborted", result: string): void {
    if (!canTransitionChaosRun(run.status, status)) throw new InvalidTransitionError(`Chaos run ${run.businessId} cannot transition to ${status}.`);
    getSimulationEngine().clearChaos(run.id);
    run.status = status;
    run.completedAt = new Date().toISOString();
    run.result = result;
    getRepos().chaosRuns.save(run);
    getRepos().activity.append({ id: `act-${crypto.randomUUID()}`, at: run.completedAt, kind: "chaos", title: `Simulated chaos run ${status}`, detail: `${run.businessId}: ${result}`, refType: null, refId: null, actor: "system" });
  }
}
