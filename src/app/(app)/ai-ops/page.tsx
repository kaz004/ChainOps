import type { Metadata } from "next";
import Link from "next/link";
import { getContainer } from "@/server/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "AI Ops" };
export const dynamic = "force-dynamic";

export default function AiOpsPage() {
  const container = getContainer();
  const incidents = container.incidentService.list().filter((incident) => incident.status !== "resolved").slice(0, 5);
  const deployments = container.deploymentService.list({ page: 1, pageSize: 5 }).items;
  const reports = incidents.map((incident) => ({ incident, result: container.aiService.analyzeIncident(incident.businessId) }));
  const risks = deployments.map((deployment) => ({ deployment, result: container.aiService.assessDeployment(deployment.businessId) }));
  return <main className="mx-auto w-full max-w-[1300px] px-4 py-6 lg:px-6"><header className="flex flex-wrap items-end justify-between gap-3 pb-5"><div><h1 className="text-lg font-semibold">AI Operations</h1><p className="text-sm text-muted-foreground">Evidence-linked incident analysis and deployment risk estimates</p></div><span className="text-[11px] text-warning">DEMO AI · deterministic · no actions executed</span></header>
    <Card className="mb-4"><CardHeader><CardTitle>Incident analysis</CardTitle></CardHeader><CardContent className="space-y-0">{reports.length ? reports.map(({ incident, result }) => <Link key={incident.id} href={`/incidents/${incident.businessId}`} className="grid gap-2 border-t border-border/60 px-1 py-3 hover:bg-accent/30 md:grid-cols-[minmax(0,1fr)_1.4fr_auto]"><div><p className="text-sm font-medium">{incident.title}</p><p className="text-xs text-muted-foreground">{incident.businessId} · {incident.severity} · {incident.status}</p></div><div><p className="text-sm">{result.likelyCause}</p><p className="mt-1 text-xs text-muted-foreground">{result.evidence.length} evidence items · {Math.round(result.confidence * 100)}% confidence</p></div><Badge variant={result.status === "complete" ? "info" : "warning"}>{result.status}</Badge></Link>) : <p className="text-sm text-muted-foreground">No open incidents to analyze.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Deployment risk</CardTitle></CardHeader><CardContent className="space-y-0">{risks.map(({ deployment, result }) => <Link key={deployment.id} href={`/deployments/${deployment.businessId}`} className="grid gap-2 border-t border-border/60 px-1 py-3 hover:bg-accent/30 md:grid-cols-[minmax(0,1fr)_1.5fr_auto]"><div><p className="text-sm font-medium">{deployment.businessId} · {deployment.serviceName} {deployment.version}</p><p className="text-xs capitalize text-muted-foreground">{deployment.environment} · {deployment.status}</p></div><p className="text-sm text-muted-foreground">{result.summary}</p><Badge variant={result.risk === "high" ? "error" : result.risk === "moderate" ? "warning" : "success"}>{result.risk} · {result.score}</Badge></Link>)}</CardContent></Card>
    <p className="mt-3 text-xs text-muted-foreground">All analysis uses current in-memory platform evidence. Confidence is a demo score, not a calibrated probability. Review recommendations manually.</p>
  </main>;
}
