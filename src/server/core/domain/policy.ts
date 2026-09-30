import type { RemediationRisk, RemediationType, UserRole } from "@/types/domain";
import type { PolicyDecision, PolicyEngine } from "@/server/core/ports/policy-engine";

const ACTION_POLICY: Record<RemediationType, { risk: RemediationRisk; policy: string }> = {
  "service-restart": { risk: "low", policy: "POL-SERVICE-RESTART" },
  "rpc-failover": { risk: "moderate", policy: "POL-RPC-FAILOVER" },
  "provider-disable": { risk: "high", policy: "POL-PROVIDER-DISABLE" },
  "deployment-rollback": { risk: "high", policy: "POL-DEPLOYMENT-ROLLBACK" },
};

export class RuleBasedPolicyEngine implements PolicyEngine {
  evaluate(type: RemediationType, role: UserRole): PolicyDecision {
    const action = ACTION_POLICY[type];
    const allowed = role !== "viewer";
    return {
      allowed,
      risk: action.risk,
      approvalRequired: true,
      policy: action.policy,
      reason: allowed ? "Action type is allowlisted; explicit approval is required before execution." : "Viewer role cannot propose remediation actions.",
    };
  }

  canApprove(risk: RemediationRisk, role: UserRole): boolean {
    if (risk === "high") return role === "owner";
    if (risk === "moderate") return role === "owner" || role === "admin";
    return role === "owner" || role === "admin" || role === "engineer";
  }

  canExecute(risk: RemediationRisk, role: UserRole): boolean {
    return this.canApprove(risk, role);
  }
}
