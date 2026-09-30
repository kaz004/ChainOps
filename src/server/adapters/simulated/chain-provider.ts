import type { ChainProvider, ChainSnapshot } from "@/server/core/ports/chain-provider";
import type { ChainNetwork } from "@/types/domain";
import { NotFoundError, ValidationError } from "@/server/core/errors";
import { getSimulationEngine } from "@/server/core/simulation/singleton";
import { simNowMs } from "@/server/core/simulation/clock";
import { getRepos } from "@/server/repositories/store";

const networkNames: Record<ChainNetwork, string> = { ethereum: "Ethereum", polygon: "Polygon", base: "Base", arbitrum: "Arbitrum" };
const gasEstimates: Record<ChainNetwork, number> = { ethereum: 18.4, polygon: 42, base: 0.012, arbitrum: 0.08 };
const blockEpoch = simNowMs();

export class SimulatedChainProvider implements ChainProvider {
  readonly name = "Deterministic simulated chain provider";
  readonly isDemo = true;

  list(): ChainSnapshot[] {
    const repos = getRepos();
    const failures = new Set(getSimulationEngine().listChainFailures().map((failure) => failure.providerId));
    return repos.chains.all().map((chain) => {
      const providers = repos.rpcProviders.all().filter((provider) => provider.chainId === chain.id)
        .map((provider) => failures.has(provider.id) ? { ...provider, status: "degraded" as const } : provider);
      const chainFailed = providers.some((provider) => failures.has(provider.id));
      const active = providers.filter((provider) => provider.trafficWeightPct > 0 && provider.status !== "down");
      const status = chainFailed || active.some((provider) => provider.status === "degraded") || active.length === 0 ? "degraded" : "healthy";
      const weighted = active.reduce((acc, provider) => ({
        weight: acc.weight + provider.trafficWeightPct,
        latency: acc.latency + provider.latencyP95Ms * provider.trafficWeightPct,
        errors: acc.errors + provider.errorRatePct * provider.trafficWeightPct,
      }), { weight: 0, latency: 0, errors: 0 });
      const degradedProvider = providers.find((provider) => failures.has(provider.id));
      const rpcLatencyP95Ms = degradedProvider ? degradedProvider.latencyP95Ms : weighted.weight ? weighted.latency / weighted.weight : 0;
      const rpcErrorRatePct = degradedProvider ? degradedProvider.errorRatePct : weighted.weight ? weighted.errors / weighted.weight : 0;
      const elapsedBlocks = Math.floor((simNowMs() - blockEpoch) / chain.blockTimeMs);
      return {
        ...chain, status, providers, networkName: networkNames[chain.network], gasEstimateGwei: gasEstimates[chain.network],
        blockHeight: chain.blockHeight + elapsedBlocks, rpcLatencyP95Ms, rpcErrorRatePct, source: "demo-chain",
      };
    });
  }

  get(idOrNetwork: string): ChainSnapshot | undefined {
    return this.list().find((chain) => chain.id === idOrNetwork || chain.network === idOrNetwork);
  }

  failover(providerId: string): { providerName: string; chainNetwork: ChainNetwork; shiftedPct: number; recipientCount: number } {
    const repos = getRepos();
    const provider = repos.rpcProviders.get(providerId);
    if (!provider) throw new NotFoundError("RPC provider", providerId);
    const alternates = repos.rpcProviders.all().filter((candidate) => candidate.chainId === provider.chainId && candidate.id !== provider.id && candidate.status === "healthy" && candidate.trafficWeightPct > 0);
    const weight = alternates.reduce((sum, candidate) => sum + candidate.trafficWeightPct, 0);
    if (!alternates.length || weight <= 0) throw new ValidationError("No healthy RPC provider is available to receive traffic.");
    const shiftedPct = provider.trafficWeightPct;
    provider.trafficWeightPct = 0;
    provider.status = "down";
    repos.rpcProviders.save(provider);
    for (const alternate of alternates) {
      alternate.trafficWeightPct += shiftedPct * alternate.trafficWeightPct / weight;
      repos.rpcProviders.save(alternate);
    }
    getSimulationEngine().clearRpcFailure(providerId);
    const network = repos.chains.get(provider.chainId)?.network;
    if (!network) throw new NotFoundError("Chain", provider.chainId);
    return { providerName: provider.name, chainNetwork: network, shiftedPct, recipientCount: alternates.length };
  }
}
