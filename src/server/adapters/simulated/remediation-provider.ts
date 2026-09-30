import type { RemediationProvider, RemediationExecutionInput, RemediationExecutionResult } from "@/server/core/ports/remediation-provider";
import type { DeploymentService } from "@/server/services/deployment-service";
import type { ChainProvider } from "@/server/core/ports/chain-provider";
import { getRepos } from "@/server/repositories/store";
import { NotFoundError } from "@/server/core/errors";

export class SimulatedRemediationProvider implements RemediationProvider {
  readonly name = "Simulated remediation executor";
  readonly isDemo = true;

  constructor(private readonly deployments: DeploymentService, private readonly chains: ChainProvider) {}

  execute(input: RemediationExecutionInput): RemediationExecutionResult {
    const repos = getRepos();
    switch (input.type) {
      case "service-restart": {
        const service = repos.services.get(input.targetId);
        if (!service) throw new NotFoundError("Service", input.targetId);
        return { verified: true, detail: `Demo restart event recorded for ${service.name}; no runtime or infrastructure state was changed.` };
      }
      case "rpc-failover":
      case "provider-disable": {
        const provider = repos.rpcProviders.get(input.targetId);
        if (!provider) throw new NotFoundError("RPC provider", input.targetId);
        const result = this.chains.failover(provider.id);
        return { verified: true, detail: `${result.providerName} disabled in the demo store; ${result.shiftedPct}% traffic redistributed across ${result.recipientCount} healthy provider(s) on ${result.chainNetwork}. No RPC endpoint was contacted.` };
      }
      case "deployment-rollback": {
        const deployment = this.deployments.rollback(input.targetId);
        return { verified: deployment.status === "rolled_back", detail: `Simulated rollback completed for ${deployment.businessId}; no deployment provider was contacted.` };
      }
    }
  }
}
