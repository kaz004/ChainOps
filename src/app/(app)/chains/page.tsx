import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getContainer } from "@/server/container";

export const metadata: Metadata = { title: "Chains" };
export const dynamic = "force-dynamic";

export default function ChainsPage() {
  const chains = getContainer().chainService.list();
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-6">
      <PageHeader title="Chain Center" description="Multichain network and RPC provider health." />
      <p className="mb-4 flex items-center gap-2 rounded-md border border-warning/25 bg-warning/5 px-3 py-2.5 text-xs text-warning">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
        SIMULATED · deterministic demo data only. No live chain or RPC endpoint is contacted.
      </p>
      <div className="space-y-3">
        {chains.map((chain) => {
          const degradedProvider = chain.providers.find(
            (provider) => provider.status !== "healthy" && provider.trafficWeightPct > 0,
          );

          return (
            <section key={chain.id} className="rounded-lg border border-border bg-card/45 p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{chain.networkName}</h2>
                    <Badge variant={chain.status === "healthy" ? "success" : "warning"}>{chain.status}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Chain ID <span className="font-data">{chain.chainId}</span>
                    <span aria-hidden className="px-1.5">·</span>
                    Block <span className="font-data">{chain.blockHeight.toLocaleString()}</span>
                    <span aria-hidden className="px-1.5">·</span>
                    {chain.blockTimeMs.toLocaleString()} ms block time
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:flex sm:gap-6">
                  <div>
                    <dt className="text-muted-foreground">Gas estimate</dt>
                    <dd className="mt-1 font-medium">{chain.gasEstimateGwei} gwei</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">RPC p95 / errors</dt>
                    <dd className="mt-1 font-medium">
                      {Math.round(chain.rpcLatencyP95Ms).toLocaleString()} ms / {chain.rpcErrorRatePct.toFixed(2)}%
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {chain.providers.map((provider) => (
                  <div key={provider.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{provider.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {provider.latencyP95Ms.toLocaleString()} ms p95 · {provider.errorRatePct}% errors
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant={provider.status === "healthy" ? "success" : provider.status === "degraded" ? "warning" : "error"}>
                        {provider.status}
                      </Badge>
                      <p className="mt-1 text-[11px] text-muted-foreground">{provider.trafficWeightPct}% traffic</p>
                    </div>
                  </div>
                ))}
              </div>

              {degradedProvider ? (
                <Link
                  className="mt-3 inline-flex min-h-8 items-center text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={`/remediations?type=rpc-failover&targetId=${encodeURIComponent(degradedProvider.id)}`}
                >
                  Propose policy-gated failover
                </Link>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
