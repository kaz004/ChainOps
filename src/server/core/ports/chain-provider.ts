import type { Chain, ChainNetwork, RpcProvider } from "@/types/domain";

export interface ChainSnapshot extends Chain {
  networkName: string;
  gasEstimateGwei: number;
  providers: RpcProvider[];
  rpcLatencyP95Ms: number;
  rpcErrorRatePct: number;
  source: "demo-chain";
}

export interface ChainProvider {
  readonly name: string;
  readonly isDemo: boolean;
  list(): ChainSnapshot[];
  get(idOrNetwork: string): ChainSnapshot | undefined;
  failover(providerId: string): { providerName: string; chainNetwork: ChainNetwork; shiftedPct: number; recipientCount: number };
}
