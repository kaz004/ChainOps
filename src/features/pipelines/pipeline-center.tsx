"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranch, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime, shortSha } from "@/lib/format";
import type { PipelineRun } from "@/types/domain";

type ProjectOption = { id: string; name: string; services: { id: string; name: string }[] };
const STATUS: Record<PipelineRun["status"], "default" | "info" | "success" | "error"> = {
  queued: "default", running: "info", success: "success", failed: "error", cancelled: "default",
};

export function PipelineCenter({ initial, projects }: { initial: PipelineRun[]; projects: ProjectOption[] }) {
  const router = useRouter();
  const [runs, setRuns] = useState(initial);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(projects[0]?.services[0]?.id ?? "");
  const [version, setVersion] = useState("v1.0.0");
  const [gitSha, setGitSha] = useState("a1b2c3d4");
  const [environment, setEnvironment] = useState("staging");
  const [failureStage, setFailureStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = runs.some((run) => run.status === "queued" || run.status === "running");
  const selected = projects.find((project) => project.id === projectId);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/pipelines", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json() as { data: PipelineRun[] };
          setRuns(payload.data);
        }
      } catch {
        setError("Pipeline updates are temporarily unavailable.");
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [active]);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await fetch("/api/pipelines", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, serviceId, version, gitSha, environment, failureStage: failureStage || null }),
      });
      const payload = await response.json() as { data?: PipelineRun; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Could not queue pipeline");
      setRuns((current) => [payload.data!, ...current]);
      router.push(`/pipelines/${payload.data.businessId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not queue pipeline");
    } finally { setBusy(false); }
  }

  return <div className="flex flex-col gap-4">
    <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-muted-foreground"><span className="font-semibold text-info">Simulated CI</span><span>Stages run locally in demo state. No external CI, source repository, or infrastructure is contacted.</span></div>
    <Card><CardHeader><CardTitle>Run pipeline</CardTitle></CardHeader><CardContent>
      {projects.length ? <form onSubmit={start} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Project<select className="h-9 rounded-md border border-input bg-background px-2 text-foreground" value={projectId} onChange={(event) => { const next = projects.find((item) => item.id === event.target.value); setProjectId(event.target.value); setServiceId(next?.services[0]?.id ?? ""); }}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Service<select className="h-9 rounded-md border border-input bg-background px-2 text-foreground" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{selected?.services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Version<Input value={version} onChange={(event) => setVersion(event.target.value)} required /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Commit SHA<Input value={gitSha} onChange={(event) => setGitSha(event.target.value)} minLength={8} maxLength={8} required /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Environment<select className="h-9 rounded-md border border-input bg-background px-2 text-foreground" value={environment} onChange={(event) => setEnvironment(event.target.value)}><option value="staging">Staging</option><option value="production">Production</option><option value="development">Development</option></select></label>
        <div className="flex items-end"><Button type="submit" disabled={busy || !serviceId}><Play aria-hidden />{busy ? "Queuing…" : "Run pipeline"}</Button></div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">Demo failure scenario (optional)<select className="h-9 rounded-md border border-input bg-background px-2 text-foreground" value={failureStage} onChange={(event) => setFailureStage(event.target.value)}><option value="">No injected failure</option>{["Source", "Lint", "Unit tests", "Integration tests", "Contract tests", "Security scan", "Build", "Staging", "Smoke tests", "Canary", "Production"].map((stage) => <option key={stage}>{stage}</option>)}</select></label>
      </form> : <p className="text-xs text-muted-foreground">No active project with deployable services.</p>}
      {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
    </CardContent></Card>
    <Table><TableHeader><TableRow><TableHead>Pipeline</TableHead><TableHead>Environment</TableHead><TableHead>Commit</TableHead><TableHead>Progress</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
      <TableBody>{runs.map((run) => <TableRow key={run.id}><TableCell><Link href={`/pipelines/${run.businessId}`} className="font-medium hover:text-primary">{run.serviceName} {run.version}</Link><div className="font-mono text-[10px] text-muted-foreground">{run.businessId}{run.deploymentId ? ` · ${run.deploymentId}` : ""}</div></TableCell><TableCell className="text-xs capitalize">{run.environment}</TableCell><TableCell className="font-mono text-xs">{shortSha(run.gitSha)}</TableCell><TableCell className="text-xs">{run.stages.filter((stage) => stage.status === "success").length}/{run.stages.length} stages</TableCell><TableCell><Badge variant={STATUS[run.status]}>{run.status}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{formatRelativeTime(run.updatedAt)}</TableCell></TableRow>)}</TableBody>
    </Table>
    {!runs.length ? <p className="py-8 text-center text-xs text-muted-foreground"><GitBranch className="mr-2 inline size-4" />No pipeline runs yet.</p> : null}
  </div>;
}
