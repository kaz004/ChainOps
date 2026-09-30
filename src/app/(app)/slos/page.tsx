import type { Metadata } from "next";
import Link from "next/link";
import { getContainer } from "@/server/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "SLOs & Error Budgets" };
export const dynamic = "force-dynamic";

export default function SlosPage() {
  const slos = getContainer().sloService.listWithBudgets();
  const stateVariant = (state: string) => state === "healthy" ? "success" : state === "breached" ? "error" : "warning";
  return <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
    <header className="flex flex-wrap items-end justify-between gap-3 pb-5"><div><h1 className="text-lg font-semibold">SLOs &amp; Error Budgets</h1><p className="text-sm text-muted-foreground">Objectives evaluated from simulated service telemetry</p></div><span className="text-[11px] text-warning">Demo / Simulation · six-hour sample window</span></header>
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Objectives</p><p className="text-xl font-semibold">{slos.length}</p></CardContent></Card><Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Healthy</p><p className="text-xl font-semibold text-success">{slos.filter((s) => s.status === "healthy").length}</p></CardContent></Card><Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">At risk / breached</p><p className="text-xl font-semibold text-warning">{slos.filter((s) => s.status !== "healthy").length}</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Service objectives</CardTitle></CardHeader><CardContent className="space-y-0 px-0">{slos.map((slo) => <Link key={slo.id} href={`/slos/${slo.id}`} className="grid gap-2 border-t border-border/60 px-4 py-3 hover:bg-accent/30 md:grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.2fr_auto] md:items-center"><div className="min-w-0"><p className="truncate text-sm font-medium">{slo.description}</p><p className="text-xs text-muted-foreground">{slo.serviceName} · {slo.kind}</p></div><div><p className="text-xs text-muted-foreground">Target</p><p className="font-mono text-sm">{slo.targetPct}%</p></div><div><p className="text-xs text-muted-foreground">Observed SLI</p><p className="font-mono text-sm">{slo.sli.observedPct === null ? "Insufficient data" : `${slo.sli.observedPct.toFixed(2)}%`}</p></div><div><div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Budget left</span><span>{slo.budget.remainingPct.toFixed(1)}%</span></div><div className="h-1.5 overflow-hidden rounded bg-muted"><div className={slo.status === "healthy" ? "h-full bg-success" : slo.status === "breached" ? "h-full bg-destructive" : "h-full bg-warning"} style={{ width: `${slo.budget.remainingPct}%` }} /></div></div><Badge variant={stateVariant(slo.status)}>{slo.status}</Badge></Link>)}</CardContent></Card>
    <p className="mt-3 text-xs text-muted-foreground">The six-hour demo sample is an estimate, not a persisted 30-day compliance record. Production deployment checks block breached objectives and burn rates above 14.4×.</p>
  </main>;
}
