import { z } from "zod";
import type { RemediationAction, RemediationAuditEvent, RemediationType, User } from "@/types/domain";
import { REMEDIATION_TYPES } from "@/types/domain";
import type { PolicyEngine } from "@/server/core/ports/policy-engine";
import type { RemediationProvider } from "@/server/core/ports/remediation-provider";
import { canTransitionRemediation } from "@/server/core/domain/state-machines";
import { InvalidTransitionError, NotFoundError, PolicyBlockedError, ValidationError } from "@/server/core/errors";
import { nextBusinessId } from "@/server/core/domain/ids";
import { getRepos } from "@/server/repositories/store";
import type { DeploymentService } from "@/server/services/deployment-service";

export const proposeRemediationSchema = z.object({
  type: z.enum(REMEDIATION_TYPES),
  targetId: z.string().min(1).max(80),
  reason: z.string().trim().min(8).max(300),
}).strict();
export type ProposeRemediationInput = z.infer<typeof proposeRemediationSchema>;

export class RemediationService {
  constructor(
    private readonly policy: PolicyEngine,
    private readonly provider: RemediationProvider,
    private readonly deployments: DeploymentService,
  ) {}

  list(): RemediationAction[] {
    return getRepos().remediations.all().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): RemediationAction {
    const found = getRepos().remediations.get(id) ?? getRepos().remediations.all().find((item) => item.businessId === id);
    if (!found) throw new NotFoundError("Remediation action", id);
    return found;
  }

  propose(input: ProposeRemediationInput, actorId: string): RemediationAction {
    const parsed = proposeRemediationSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Remediation request is malformed or contains unsupported fields.");
    const actor = this.resolveActor(actorId);
    const decision = this.policy.evaluate(parsed.data.type, actor.role);
    if (!decision.allowed) throw new PolicyBlockedError(decision.reason);
    const targetName = this.validateTarget(parsed.data.type, parsed.data.targetId);
    const now = new Date().toISOString();
    const businessId = nextBusinessId("REM");
    const action: RemediationAction = {
      id: businessId.toLowerCase(), businessId, type: parsed.data.type, targetId: parsed.data.targetId,
      targetName, risk: decision.risk, reason: parsed.data.reason, policy: decision.policy,
      approvalRequired: decision.approvalRequired, status: "proposed", requestedBy: actor.name,
      approvedBy: null, createdAt: now, updatedAt: now, result: null,
      auditEvents: [this.audit("proposed", actor.name, `${decision.policy}: ${decision.reason}`, now)],
    };
    getRepos().remediations.insert(action);
    getRepos().activity.append({ id: `act-${crypto.randomUUID()}`, at: now, kind: "system", title: "Remediation proposed", detail: `${businessId} · ${parsed.data.type} · ${targetName}`, refType: null, refId: null, actor: actor.name });
    return action;
  }

  approve(id: string, actorId: string): RemediationAction {
    const action = this.get(id);
    const actor = this.resolveActor(actorId);
    if (!this.policy.canApprove(action.risk, actor.role)) throw new PolicyBlockedError(`Role ${actor.role} cannot approve ${action.risk}-risk remediation.`);
    if (!canTransitionRemediation(action.status, "approved")) throw new InvalidTransitionError(`Remediation ${action.businessId} cannot be approved from ${action.status}.`);
    action.status = "approved";
    action.approvedBy = actor.name;
    this.record(action, "approved", actor.name, `Approved under ${action.policy}.`);
    return action;
  }

  reject(id: string, actorId: string): RemediationAction {
    const action = this.get(id);
    const actor = this.resolveActor(actorId);
    if (!this.policy.canApprove(action.risk, actor.role)) throw new PolicyBlockedError(`Role ${actor.role} cannot reject ${action.risk}-risk remediation.`);
    if (!canTransitionRemediation(action.status, "rejected")) throw new InvalidTransitionError(`Remediation ${action.businessId} cannot be rejected from ${action.status}.`);
    action.status = "rejected";
    this.record(action, "rejected", actor.name, "Approval denied; no action was executed.");
    return action;
  }

  execute(id: string, actorId: string): RemediationAction {
    const action = this.get(id);
    const actor = this.resolveActor(actorId);
    if (action.approvalRequired && action.status !== "approved") throw new PolicyBlockedError("A remediation action must be explicitly approved before execution.");
    if (!this.policy.canExecute(action.risk, actor.role)) throw new PolicyBlockedError(`Role ${actor.role} cannot execute ${action.risk}-risk remediation.`);
    if (!canTransitionRemediation(action.status, "executing")) throw new InvalidTransitionError(`Remediation ${action.businessId} cannot execute from ${action.status}.`);
    action.status = "executing";
    this.record(action, "execution-started", actor.name, `Started through ${this.provider.name}.`);
    try {
      const result = this.provider.execute({ actionId: action.businessId, type: action.type, targetId: action.targetId });
      action.result = result.detail;
      action.status = result.verified ? "succeeded" : "failed";
      this.record(action, result.verified ? "execution-succeeded" : "execution-failed", "simulated executor", result.detail);
    } catch (error) {
      action.status = "failed";
      action.result = error instanceof Error ? error.message : "Simulated execution failed.";
      this.record(action, "execution-failed", "simulated executor", action.result);
    }
    return action;
  }

  private validateTarget(type: RemediationType, targetId: string): string {
    const repos = getRepos();
    switch (type) {
      case "service-restart": {
        const service = repos.services.get(targetId);
        if (!service) throw new NotFoundError("Service", targetId);
        return service.name;
      }
      case "rpc-failover":
      case "provider-disable": {
        const provider = repos.rpcProviders.get(targetId);
        if (!provider) throw new NotFoundError("RPC provider", targetId);
        const alternates = repos.rpcProviders.all().filter((candidate) => candidate.chainId === provider.chainId && candidate.id !== provider.id && candidate.status === "healthy");
        if (!alternates.length) throw new ValidationError("The provider has no healthy same-chain failover target.");
        if (type === "rpc-failover" && provider.status === "healthy") throw new ValidationError("RPC failover requires an unhealthy provider target.");
        return `${repos.chains.get(provider.chainId)?.network ?? provider.chainId} · ${provider.name}`;
      }
      case "deployment-rollback": {
        const deployment = this.deployments.get(targetId);
        if (deployment.status !== "failed") throw new ValidationError("Only failed deployments are eligible for the simulated rollback action.");
        return `${deployment.businessId} · ${deployment.serviceName} ${deployment.version}`;
      }
    }
  }

  private resolveActor(actorId: string): User {
    const user = getRepos().users.find((candidate) => candidate.id === actorId);
    if (!user) throw new PolicyBlockedError("The demo principal is not recognized.");
    return user;
  }

  private record(action: RemediationAction, kind: RemediationAuditEvent["kind"], actor: string, detail: string): void {
    const now = new Date().toISOString();
    action.updatedAt = now;
    action.auditEvents.push(this.audit(kind, actor, detail, now));
    getRepos().remediations.save(action);
    getRepos().activity.append({ id: `act-${crypto.randomUUID()}`, at: now, kind: "system", title: `Remediation ${kind}`, detail: `${action.businessId}: ${detail}`, refType: null, refId: null, actor });
  }

  private audit(kind: RemediationAuditEvent["kind"], actor: string, detail: string, at: string): RemediationAuditEvent {
    return { id: `ra-${crypto.randomUUID()}`, at, kind, actor, detail };
  }
}
