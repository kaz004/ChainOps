import { beforeEach, describe, expect, it } from "vitest";
import { SimulatedChainProvider } from "@/server/adapters/simulated/chain-provider";
import { getSimulationEngine } from "@/server/core/simulation/singleton";
import { resetRepos } from "@/server/repositories/store";

describe("SimulatedChainProvider", () => {
  beforeEach(() => {
    resetRepos();
    getSimulationEngine().clearRpcFailure("rpc-base-b");
    getSimulationEngine().injectRpcFailure("rpc-base-b");
  });

  it("provides deterministic network data and marks only the affected network degraded", () => {
    const provider = new SimulatedChainProvider();
    const chains = provider.list();
    expect(provider.isDemo).toBe(true);
    expect(chains.map((chain) => chain.network)).toEqual(["ethereum", "polygon", "base", "arbitrum"]);
    expect(chains.find((chain) => chain.network === "base")?.status).toBe("degraded");
    expect(chains.find((chain) => chain.network === "ethereum")?.status).toBe("healthy");
    expect(chains.find((chain) => chain.network === "base")?.rpcErrorRatePct).toBe(11.4);
  });

  it("shifts traffic to healthy peers and clears the simulated provider failure", () => {
    const provider = new SimulatedChainProvider();
    const result = provider.failover("rpc-base-b");
    const base = provider.get("base");
    expect(result.shiftedPct).toBe(20);
    expect(result.recipientCount).toBe(2);
    expect(base?.status).toBe("healthy");
    expect(base?.providers.find((item) => item.id === "rpc-base-b")?.trafficWeightPct).toBe(0);
    expect(base?.providers.filter((item) => item.status === "healthy").reduce((sum, item) => sum + item.trafficWeightPct, 0)).toBe(100);
  });
});
