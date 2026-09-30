import { z } from "zod";
import type { Deployment, DeploymentStatus } from "@/types/domain";
import { getRepos } from "@/server/repositories/store";
import { nextBusinessId } from "@/server/core/domain/ids";
import { InvalidTransitionError, NotFoundError, PolicyBlockedError, ValidationError } from "@/server/core/errors";
import { MockDeploymentProvider } from "@/server/adapters/simulated/deployment-provider";
import type { DeploymentProvider } from "@/server/core/ports/deployment-provider";
import {
  DEPLOYMENT_STATUS_VALUES,
  DEPLOYMENT_STEPS,
  canTransitionDeployment,
  isDeploymentActive,
} from "@/server/core/domain/state-machines";

export const listDeploymentsQuery = z.object({
  projectId: z.string().optional(),
  environment: z.enum(["production", "staging", "development"]).optional(),
  status: z.enum(DEPLOYMENT_STATUS_VALUES).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListDeploymentsQuery = z.infer<typeof listDeploymentsQuery>;

export const createDeploymentSchema = z.object({
  projectId: z.string().min(1),
  serviceId: z.string().min(1),
  version: z.string().regex(/^v?\d+\.\d+\.\d+$/, "Version must look like v1.2.3"),
  gitSha: z.string().regex(/^[\da-f]{8}$/i, "Commit SHA must be 8 hexadecimal characters"),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  simulatedFailureStep: z.string().refine((value) => DEPLOYMENT_STEPS.includes(value)).nullable().optional(),
});

export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export class DeploymentService {
  constructor(
    private readonly provider: DeploymentProvider = new MockDeploymentProvider(),
    private readonly productionPolicy?: (serviceId: string) => string | null,
  ) {}

  list(query: ListDeploymentsQuery): Paginated<Deployment> {
    const repos = getRepos();
    let items = repos.deployments.all().map((deployment) => this.settle(deployment));

    if (query.projectId) items = items.filter((d) => d.projectId === query.projectId);
    if (query.environment) items = items.filter((d) => d.environment === query.environment);
    if (query.status) {
      items = items.filter((d) => d.status === query.status);
    }
    if (query.q) {
      const q = query.q.toLowerCase();
      items = items.filter(
        (d) =>
          d.serviceName.toLowerCase().includes(q) ||
          d.version.toLowerCase().includes(q) ||
          d.gitSha.toLowerCase().includes(q) ||
          d.businessId.toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = items.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  get(idOrBusinessId: string): Deployment {
    const repos = getRepos();
    const found =
      repos.deployments.get(idOrBusinessId) ??
      repos.deployments.all().find((d) => d.businessId === idOrBusinessId);
    if (!found) throw new NotFoundError("Deployment", idOrBusinessId);
    return this.settle(found);
  }

  /** Deployments for one project, newest first. */
  listForProject(projectId: string, limit = 8): Deployment[] {
    const repos = getRepos();
    return repos.deployments
      .all()
      .filter((d) => d.projectId === projectId)
      .map((deployment) => this.settle(deployment))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  create(input: CreateDeploymentInput): Deployment {
    const repos = getRepos();
    const service = repos.services.get(input.serviceId);
    if (!service) throw new NotFoundError("Service", input.serviceId);
    const project = repos.projects.getById(input.projectId);
    if (!project) throw new NotFoundError("Project", input.projectId);
    if (project.status === "archived") throw new ValidationError("Archived projects cannot receive deployments.");
    if (service.projectId !== project.id) throw new ValidationError("The selected service does not belong to this project.");
    if (input.environment === "production") {
      const reason = this.productionPolicy?.(service.id);
      if (reason) throw new PolicyBlockedError(reason);
    }

    const now = new Date().toISOString();
    const businessId = nextBusinessId("DEP");
    const deployment: Deployment = {
      id: businessId.toLowerCase(),
      businessId,
      projectId: input.projectId,
      serviceId: input.serviceId,
      serviceName: service.name,
      version: input.version.startsWith("v") ? input.version : `v${input.version}`,
      gitSha: input.gitSha,
      environment: input.environment,
      trigger: "manual",
      status: "queued",
      steps: DEPLOYMENT_STEPS.map((name) => ({
        id: `st-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        status: "pending" as const,
        startedAt: null,
        endedAt: null,
      })),
      logs: [{ id: `dlog-${crypto.randomUUID()}`, at: now, level: "info", message: `Queued with ${this.provider.name}` }],
      simulatedFailureStep: input.simulatedFailureStep ?? null,
      isSimulatedRun: true,
      canary: null,
      durationMs: null,
      triggeredByName: "Adrian Vale",
      createdAt: now,
      updatedAt: now,
    };

    repos.deployments.insert(deployment);
    repos.activity.append({
      id: `act-${crypto.randomUUID()}`,
      at: now,
      kind: "deployment",
      title: "Deployment queued",
      detail: `${service.name} ${deployment.version} → ${input.environment}`,
      refType: "deployment",
      refId: deployment.businessId,
      actor: "Adrian Vale",
    });

    return deployment;
  }

  createFromPipeline(input: CreateDeploymentInput): Deployment {
    const deployment = this.create(input);
    deployment.trigger = "pipeline";
    getRepos().deployments.save(deployment);
    return deployment;
  }

  /** Guarded status transition (docs/02 §3). */
  transition(idOrBusinessId: string, to: DeploymentStatus): Deployment {
    const repos = getRepos();
    const deployment = this.get(idOrBusinessId);
    if (!canTransitionDeployment(deployment.status, to)) {
      throw new InvalidTransitionError(
        `Deployment ${deployment.businessId} cannot transition ${deployment.status} → ${to}`,
      );
    }
    deployment.status = to;
    deployment.updatedAt = new Date().toISOString();
    deployment.logs.push({
      id: `dlog-${crypto.randomUUID()}`,
      at: deployment.updatedAt,
      level: to === "failed" ? "error" : "info",
      message: `Deployment entered ${to.replace(/_/g, " ")}`,
    });
    repos.deployments.save(deployment);
    repos.activity.append({
      id: `act-${crypto.randomUUID()}`,
      at: deployment.updatedAt,
      kind: "deployment",
      title: `Deployment ${to.replace(/_/g, " ")}`,
      detail: `${deployment.serviceName} ${deployment.version}`,
      refType: "deployment",
      refId: deployment.businessId,
      actor: "Adrian Vale",
    });
    return deployment;
  }

  cancel(idOrBusinessId: string): Deployment {
    return this.transition(idOrBusinessId, "cancelled");
  }

  rollback(idOrBusinessId: string): Deployment {
    let deployment = this.transition(idOrBusinessId, "rollback_pending");
    deployment = this.transition(deployment.id, "rolling_back");
    deployment = this.transition(deployment.id, "rolled_back");
    const now = new Date().toISOString();
    deployment.logs.push({ id: `dlog-${crypto.randomUUID()}`, at: now, level: "warning", message: "Demo rollback completed; no infrastructure was changed." });
    deployment.updatedAt = now;
    getRepos().deployments.save(deployment);
    return deployment;
  }

  retry(idOrBusinessId: string): Deployment {
    const previous = this.get(idOrBusinessId);
    if (previous.status !== "failed" && previous.status !== "cancelled") {
      throw new InvalidTransitionError(`Deployment ${previous.businessId} can only be retried after failure or cancellation`);
    }
    return this.create({
      projectId: previous.projectId,
      serviceId: previous.serviceId,
      version: previous.version,
      gitSha: previous.gitSha,
      environment: previous.environment,
      simulatedFailureStep: previous.simulatedFailureStep,
    });
  }

  private settle(deployment: Deployment): Deployment {
    const proposed = this.provider.advance(deployment, Date.now());
    const progressed = this.applyLegalProgression(deployment, proposed);
    if (progressed !== deployment) {
      getRepos().deployments.save(progressed);
      if (progressed.status !== deployment.status) {
        const terminal = ["success", "failed"].includes(progressed.status);
        getRepos().activity.append({
          id: `act-${crypto.randomUUID()}`,
          at: progressed.updatedAt,
          kind: "deployment",
          title: `Deployment ${progressed.status.replace(/_/g, " ")}`,
          detail: `${progressed.serviceName} ${progressed.version}`,
          refType: "deployment",
          refId: progressed.businessId,
          actor: terminal ? "demo engine" : "system",
        });
      }
    }
    return progressed;
  }

  private applyLegalProgression(current: Deployment, proposed: Deployment): Deployment {
    if (current.status === proposed.status || !isDeploymentActive(current.status)) return proposed;
    const paths: Partial<Record<DeploymentStatus, DeploymentStatus[]>> = {
      queued: proposed.status === "failed" ? ["running", "failed"] : ["running", "canary", "verifying", "success"],
      running: proposed.status === "failed" ? ["failed"] : ["canary", "verifying", "success"],
      canary: proposed.status === "failed" ? ["failed"] : ["verifying", "success"],
      verifying: proposed.status === "failed" ? ["failed"] : ["success"],
    };
    const path = paths[current.status] ?? [];
    const targetIndex = path.indexOf(proposed.status);
    if (targetIndex < 0) return proposed;
    let previous = current.status;
    for (const state of path.slice(0, targetIndex + 1)) {
      if (!canTransitionDeployment(previous, state)) {
        throw new InvalidTransitionError(`Deployment ${current.businessId} cannot progress ${previous} → ${state}`);
      }
      previous = state;
      if (state === proposed.status) break;
    }
    return proposed;
  }

  creationOptions(): { projects: { id: string; name: string; services: { id: string; name: string }[] }[] } {
    const repos = getRepos();
    return {
      projects: repos.projects.all().filter((project) => project.status === "active").map((project) => ({
        id: project.id,
        name: project.name,
        services: repos.services.all().filter((service) => service.projectId === project.id).map(({ id, name }) => ({ id, name })),
      })).filter((project) => project.services.length > 0),
    };
  }

  isActive(d: Deployment): boolean {
    return isDeploymentActive(d.status);
  }
}
