import type { RemediationRisk, RemediationType, UserRole } from "@/types/domain";

export interface PolicyDecision {
  allowed: boolean;
  risk: RemediationRisk;
  approvalRequired: boolean;
  policy: string;
  reason: string;
}

export interface PolicyEngine {
  evaluate(type: RemediationType, role: UserRole): PolicyDecision;
  canApprove(risk: RemediationRisk, role: UserRole): boolean;
  canExecute(risk: RemediationRisk, role: UserRole): boolean;
}
