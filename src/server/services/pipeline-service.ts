import { z } from "zod";
import type { PipelineRun, PipelineStatus } from "@/types/domain";
import { getRepos } from "@/server/repositories/store";
import { nextBusinessId } from "@/server/core/domain/ids";
import { ConflictError, InvalidTransitionError, NotFoundError, ValidationError } from "@/server/core/errors";
import { canTransitionPipeline, canTransitionPipelineStage, PIPELINE_STAGE_NAMES } from "@/server/core/domain/state-machines";
import { createDeploymentSchema, type DeploymentService } from "@/server/services/deployment-service";

const PIPELINE_STEP_MS = 1_200;

export const createPipelineSchema = createDeploymentSchema.extend({
  failureStage: z.enum(PIPELINE_STAGE_NAMES).nullable().optional(),
}).omit({ simulatedFailureStep: true });
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;

export class PipelineService {
  constructor(private readonly deployments: DeploymentService) {}

  list(): PipelineRun[] {
    return getRepos().pipelineRuns.all().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50).map((run) => this.settle(run));
  }

  get(idOrBusinessId: string): PipelineRun {
    const repos = getRepos();
    const run = repos.pipelineRuns.get(idOrBusinessId) ?? repos.pipelineRuns.all().find((item) => item.businessId === idOrBusinessId);
    if (!run) throw new NotFoundError("Pipeline run", idOrBusinessId);
    return this.settle(run);
  }

  create(input: CreatePipelineInput): PipelineRun {
    const repos = getRepos();
    const service = repos.services.get(input.serviceId);
    const project = repos.projects.getById(input.projectId);
    if (!service) throw new NotFoundError("Service", input.serviceId);
    if (!project) throw new NotFoundError("Project", input.projectId);
    if (project.status !== "active") throw new ValidationError("Archived projects cannot run pipelines.");
    if (service.projectId !== project.id) throw new ValidationError("The selected service does not belong to this project.");
    const now = new Date().toISOString();
    const businessId = nextBusinessId("PIP");
    const run: PipelineRun = {
      id: businessId.toLowerCase(), businessId, projectId: project.id, serviceId: service.id,
      serviceName: service.name, version: input.version.startsWith("v") ? input.version : `v${input.version}`,
      gitSha: input.gitSha, environment: input.environment, status: "queued",
      stages: PIPELINE_STAGE_NAMES.map((name, index) => ({ id: `ps-${businessId.toLowerCase()}-${index}`, name, status: "pending", startedAt: null, endedAt: null, log: [] })),
      deploymentId: null, failureStage: input.failureStage ?? null, startStageIndex: 0,
      startedAt: now, completedAt: null, createdAt: now, updatedAt: now,
    };
    repos.pipelineRuns.insert(run);
    repos.activity.append({ id: `act-${crypto.randomUUID()}`, at: now, kind: "system", title: "Pipeline queued", detail: `${service.name} ${run.version}`, refType: null, refId: null, actor: "Adrian Vale" });
    return run;
  }

  cancel(idOrBusinessId: string): PipelineRun {
    const run = this.get(idOrBusinessId);
    this.transition(run, "cancelled");
    const now = new Date().toISOString();
    run.stages = run.stages.map((stage) => stage.status === "pending" || stage.status === "running" ? { ...stage, status: "cancelled" } : stage);
    run.updatedAt = now;
    getRepos().pipelineRuns.save(run);
    getRepos().activity.append({ id: `act-${crypto.randomUUID()}`, at: now, kind: "system", title: "Pipeline cancelled", detail: `${run.serviceName} ${run.version}`, refType: null, refId: null, actor: "Adrian Vale" });
    return run;
  }

  retryFailedStage(idOrBusinessId: string): PipelineRun {
    const run = this.get(idOrBusinessId);
    if (run.status !== "failed") throw new InvalidTransitionError("Only a failed pipeline run can be retried.");
    const failedIndex = run.stages.findIndex((stage) => stage.status === "failed");
    if (failedIndex < 0) throw new ConflictError("The failed pipeline stage could not be identified.");
    if (!canTransitionPipeline(run.status, "running") || !canTransitionPipelineStage("failed", "running")) {
      throw new InvalidTransitionError("The failed pipeline stage cannot be retried.");
    }
    run.status = "running";
    run.startStageIndex = failedIndex;
    run.failureStage = null;
    run.startedAt = new Date().toISOString();
    run.completedAt = null;
    run.stages = run.stages.map((stage, index) => index >= failedIndex ? { ...stage, status: "pending", startedAt: null, endedAt: null } : stage);
    const failedStage = run.stages[failedIndex];
    if (!failedStage) throw new ConflictError("The failed pipeline stage could not be identified.");
    run.stages[failedIndex] = { ...failedStage, status: "running", startedAt: run.startedAt, log: [...failedStage.log, "Retry started"] };
    run.updatedAt = run.startedAt;
    getRepos().pipelineRuns.save(run);
    getRepos().activity.append({ id: `act-${crypto.randomUUID()}`, at: run.updatedAt, kind: "system", title: "Pipeline stage retry started", detail: `${run.serviceName} ${run.version}: ${failedStage.name}`, refType: null, refId: null, actor: "Adrian Vale" });
    return run;
  }

  private transition(run: PipelineRun, to: PipelineStatus): void {
    if (!canTransitionPipeline(run.status, to)) throw new InvalidTransitionError(`Pipeline ${run.businessId} cannot transition ${run.status} → ${to}`);
    run.status = to;
    run.updatedAt = new Date().toISOString();
    if (to === "success" || to === "failed" || to === "cancelled") run.completedAt = run.updatedAt;
  }

  private settle(run: PipelineRun): PipelineRun {
    if (run.status === "success" || run.status === "failed" || run.status === "cancelled") return run;
    const now = Date.now();
    const elapsedStages = Math.floor((now - Date.parse(run.startedAt)) / PIPELINE_STEP_MS);
    const failIndex = run.failureStage === null ? -1 : run.stages.findIndex((stage) => stage.name === run.failureStage);
    const shouldFail = failIndex >= run.startStageIndex && elapsedStages > failIndex - run.startStageIndex;
    const completed = shouldFail ? failIndex : Math.min(run.stages.length, run.startStageIndex + Math.max(0, elapsedStages));
    const current = { ...run, stages: run.stages.map((stage) => ({ ...stage, log: [...stage.log] })) };
    const timestamp = new Date(now).toISOString();

    if (current.status === "queued") this.transition(current, "running");
    current.stages = current.stages.map((stage, index) => {
      if (index < completed) {
        const nextStatus = "success" as const;
        const validPath = stage.status === "pending"
          ? canTransitionPipelineStage(stage.status, "running") && canTransitionPipelineStage("running", nextStatus)
          : canTransitionPipelineStage(stage.status, nextStatus);
        if (stage.status !== nextStatus && validPath) {
          return { ...stage, status: nextStatus, startedAt: stage.startedAt ?? timestamp, endedAt: timestamp, log: [...stage.log, `${stage.name} completed in deterministic demo pipeline`] };
        }
        return stage;
      }
      if (index === completed && completed < current.stages.length && !shouldFail) {
        return { ...stage, status: "running", startedAt: stage.startedAt ?? timestamp, log: stage.status === "running" ? stage.log : [...stage.log, `${stage.name} started`] };
      }
      return stage;
    });

    if (shouldFail) {
      const failed = current.stages[failIndex];
      const validFailurePath = failed && (failed.status === "pending"
        ? canTransitionPipelineStage("pending", "running") && canTransitionPipelineStage("running", "failed")
        : canTransitionPipelineStage(failed.status, "failed"));
      if (failed && validFailurePath) {
        current.stages[failIndex] = { ...failed, status: "failed", startedAt: failed.startedAt ?? timestamp, endedAt: timestamp, log: [...failed.log, "Deterministic demo failure injected"] };
      }
      this.transition(current, "failed");
    } else if (completed >= current.stages.length) {
      if (current.deploymentId === null) {
        const input: CreatePipelineInput = { projectId: current.projectId, serviceId: current.serviceId, version: current.version, gitSha: current.gitSha, environment: current.environment };
        const deployment = this.deployments.createFromPipeline(input);
        current.deploymentId = deployment.businessId;
      }
      this.transition(current, "success");
    }

    if (current.status !== run.status || current.stages.some((stage, index) => stage.status !== run.stages[index]?.status || stage.log.length !== run.stages[index]?.log.length)) {
      getRepos().pipelineRuns.save(current);
      if (current.status === "success" || current.status === "failed" || current.status === "cancelled") {
        getRepos().activity.append({ id: `act-${crypto.randomUUID()}`, at: current.updatedAt, kind: "system", title: `Pipeline ${current.status}`, detail: `${current.serviceName} ${current.version}`, refType: null, refId: null, actor: "demo engine" });
      }
      return current;
    }
    return run;
  }
}
