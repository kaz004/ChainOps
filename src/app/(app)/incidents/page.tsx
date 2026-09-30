import type { Metadata } from "next";
import Link from "next/link";
import { getContainer } from "@/server/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetectIncidentsButton } from "@/features/incidents/incident-controls";
import { incidentListQuerySchema } from "@/server/services/incident-service";

export const metadata: Metadata = { title: "Incidents" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function IncidentsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const input = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]]));
  const parsed = incidentListQuerySchema.safeParse(input);
  const filters = parsed.success ? parsed.data : incidentListQuerySchema.parse({});
  const incidents = getContainer().incidentService.search(filters);
  const alerts = getContainer().incidentService.listAlerts();
  return <main className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-6"><header className="flex flex-wrap items-end justify-between gap-4 pb-5"><div><h1 className="text-lg font-semibold">Incidents</h1><p className="text-sm text-muted-foreground">Alert-driven response with telemetry and deployment context</p></div><div className="flex items-center gap-3"><span className="text-[11px] text-warning">Demo / Simulation</span><DetectIncidentsButton /></div></header>
    <Card className="mb-4"><CardHeader><CardTitle>Alerts <span className="ml-2 text-xs font-normal text-muted-foreground">{alerts.filter((a) => a.status === "firing").length} firing</span></CardTitle></CardHeader><CardContent className="px-0">{alerts.length ? alerts.map((alert) => <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3"><div><div className="flex items-center gap-2"><Badge variant={alert.status === "firing" ? "error" : "success"}>{alert.status}</Badge><span className="text-sm font-medium">{alert.title}</span></div><p className="mt-1 text-xs text-muted-foreground">{alert.businessId} · {alert.metric} {alert.observedValue.toFixed(2)}% vs {alert.threshold}% · {new Date(alert.firstFiredAt).toLocaleString()}</p></div>{alert.incidentId ? <Link className="text-xs text-primary" href={`/incidents/${alert.incidentId}`}>Open incident</Link> : <span className="text-xs text-muted-foreground">No incident linked</span>}</div>) : <p className="p-4 text-sm text-muted-foreground">No alerts have fired.</p>}</CardContent></Card>
    <form action="/incidents" className="mb-3 flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs text-muted-foreground">Status<select name="status" defaultValue={filters.status ?? "all"} className="h-9 rounded border border-input bg-background px-2 text-sm text-foreground"><option value="all">All statuses</option>{["detected", "investigating", "mitigating", "monitoring", "resolved"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="grid gap-1 text-xs text-muted-foreground">Severity<select name="severity" defaultValue={filters.severity ?? "all"} className="h-9 rounded border border-input bg-background px-2 text-sm text-foreground"><option value="all">All severities</option>{["sev-1", "sev-2", "sev-3", "sev-4"].map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select></label><label className="grid gap-1 text-xs text-muted-foreground">Search<input name="q" defaultValue={filters.q} placeholder="Incident or summary" className="h-9 w-56 rounded border border-input bg-background px-2 text-sm text-foreground" /></label><button className="h-9 rounded border border-input px-3 text-sm hover:bg-accent">Filter</button></form>
    <Card><CardHeader><CardTitle>Incident history</CardTitle></CardHeader><CardContent className="px-0">{incidents.length ? incidents.map((incident) => <Link key={incident.id} href={`/incidents/${incident.id}`} className="grid gap-2 border-t border-border/60 px-4 py-3 hover:bg-accent/30 md:grid-cols-[minmax(0,1.4fr)_1fr_1.2fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{incident.title}</span><Badge variant={incident.severity === "sev-1" ? "error" : incident.severity === "sev-2" ? "warning" : "info"}>{incident.severity}</Badge></div><p className="text-xs text-muted-foreground">{incident.businessId} · {incident.serviceIds.length} affected service(s)</p></div><span className="text-xs capitalize text-muted-foreground">{incident.status}</span><time className="text-xs text-muted-foreground">Detected {new Date(incident.detectedAt).toLocaleString()}</time><span className="text-xs text-primary">Details →</span></Link>) : <p className="p-5 text-sm text-muted-foreground">No incidents match these filters.</p>}</CardContent></Card>
  </main>;
}
