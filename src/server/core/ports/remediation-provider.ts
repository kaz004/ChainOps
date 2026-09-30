import type { RemediationType } from "@/types/domain";

export interface RemediationExecutionInput {
  actionId: string;
  type: RemediationType;
  targetId: string;
}

export interface RemediationExecutionResult {
  verified: boolean;
  detail: string;
}

export interface RemediationProvider {
  readonly name: string;
  readonly isDemo: boolean;
  execute(input: RemediationExecutionInput): RemediationExecutionResult;
}
