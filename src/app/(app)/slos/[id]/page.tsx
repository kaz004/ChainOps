import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContainer } from "@/server/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "SLO Detail" };
export const dynamic = "force-dynamic";

export default async function SloDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let slo;
  try { slo = getContainer().sloService.get(id); } catch { notFound(); }
  const variant = slo.status === "healthy" ? "success" : slo.status === "breached" ? "error" : "warning";
  return <main className="mx-auto w-full max-w-[1000px] px-4 py-6 lg:px-6"><Link className="text-xs text-primary" href="/slos">← All SLOs</Link><header className="flex flex-wrap items-start justify-between gap-3 py-4"><div><h1 className="text-lg font-semibold">{slo.description}</h1><p className="text-sm text-muted-foreground">{slo.serviceName} · {slo.kind} · {slo.windowDays}-day objective</p></div><Badge variant={variant}>{slo.status}</Badge></header>
    <div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Service-level indicator</CardTitle></CardHeader><CardContent><p className="font-mono text-3xl">{slo.sli.observedPct === null ? "--" : `${slo.sli.observedPct.toFixed(2)}%`}</p><p className="mt-2 text-sm text-muted-foreground">Target {slo.targetPct}% · {slo.sli.requestVolume.toLocaleString()} sampled requests across {slo.sli.sampleCount} intervals</p><p className="mt-1 text-xs text-warning">Six-hour simulated observation; longer-window history is not persisted.</p></CardContent></Card>
    <Card><CardHeader><CardTitle>Error budget</CardTitle></CardHeader><CardContent><div className="mb-2 flex justify-between text-sm"><span>Remaining</span><span className="font-mono">{slo.budget.remainingPct.toFixed(2)}%</span></div><div className="h-3 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${slo.budget.remainingPct}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{slo.budget.consumedPct.toFixed(2)}% consumed · projected exhaustion {slo.budget.projectedExhaustionAt ? new Date(slo.budget.projectedExhaustionAt).toLocaleString() : "not projected"}</p></CardContent></Card>
    <Card className="md:col-span-2"><CardHeader><CardTitle>Burn rate</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{[{ label: "1 hour", value: slo.budget.burnRate1h }, { label: "6 hours", value: slo.budget.burnRate6h }].map((item) => <div key={item.label}><div className="mb-1 flex justify-between text-sm"><span>{item.label}</span><span className="font-mono">{item.value.toFixed(2)}×</span></div><div className="h-2 overflow-hidden rounded bg-muted"><div className={item.value > 14.4 ? "h-full bg-destructive" : item.value > 1 ? "h-full bg-warning" : "h-full bg-success"} style={{ width: `${Math.min(100, item.value / 20 * 100)}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">Fast-burn threshold: 14.4×</p></div>)}</CardContent></Card></div>
  </main>;
}
