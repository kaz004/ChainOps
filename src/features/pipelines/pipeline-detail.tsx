"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, shortSha } from "@/lib/format";
import type { PipelineRun } from "@/types/domain";

const STAGE_VARIANT = { pending: "default", running: "info", success: "success", failed: "error", skipped: "default", cancelled: "default" } as const;

export function PipelineDetail({ initial }: { initial: PipelineRun }) {
  const router = useRouter();
  const [run, setRun] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/pipelines/${run.businessId}`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json() as { data: PipelineRun };
        setRun(payload.data);
      }
    } catch {
      setError("Pipeline updates are temporarily unavailable.");
    }
  }, [run.businessId]);
  useEffect(() => {
    if (run.status !== "queued" && run.status !== "running") return;
    const timer = setInterval(() => void refresh(), 1_000);
    return () => clearInterval(timer);
  }, [run.status, refresh]);

  async function act(action: "cancel" | "retry-failed-stage") {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/pipelines/${run.businessId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json() as { data?: PipelineRun; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Pipeline action failed");
      setRun(payload.data); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pipeline action failed");
    } finally { setBusy(false); }
  }

  const canCancel = run.status === "queued" || run.status === "running";
  const canRetry = run.status === "failed";
  const progress = Math.round((run.stages.filter((stage) => stage.status === "success").length / run.stages.length) * 100);

  return <>
    <PageHeader breadcrumbs={[{ label: "Pipelines", href: "/pipelines" }, { label: run.businessId }]} title={`${run.serviceName} ${run.version}`} description={`${run.environment} · commit ${shortSha(run.gitSha)} · ${run.businessId}`} action={<div className="flex items-center gap-2"><Badge variant={run.status === "success" ? "success" : run.status === "failed" ? "error" : run.status === "running" ? "info" : "default"}>{run.status}</Badge>{canCancel ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void act("cancel")}><Ban aria-hidden />Cancel</Button> : null}{canRetry ? <Button size="sm" disabled={busy} onClick={() => void act("retry-failed-stage")}><RotateCcw aria-hidden />Retry failed stage</Button> : null}</div>} />
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-muted-foreground"><span className="font-semibold text-info">Simulated CI</span> · No external CI system, repository, or infrastructure was contacted.</div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <Card><CardHeader><CardTitle>Pipeline progress · {progress}%</CardTitle></CardHeader><CardContent><div role="progressbar" aria-label="Pipeline progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Stages</CardTitle></CardHeader><CardContent className="flex flex-col gap-1">
        {run.stages.map((stage, index) => <div key={stage.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-border/70 py-3 last:border-0">
          <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0"><p className="text-xs font-medium">{stage.name}</p>{stage.log.map((line, lineIndex) => <p key={`${stage.id}-${lineIndex}`} className="mt-1 font-mono text-[10px] text-muted-foreground">{line}</p>)}{stage.startedAt ? <p className="mt-1 text-[10px] text-muted-foreground">Started {formatRelativeTime(stage.startedAt)}{stage.endedAt ? ` · ended ${formatRelativeTime(stage.endedAt)}` : ""}</p> : null}</div>
          <Badge variant={STAGE_VARIANT[stage.status]}>{stage.status}</Badge>
        </div>)}
      </CardContent></Card>
      {run.deploymentId ? <p className="text-xs text-muted-foreground">Production release created: <Link className="font-mono text-primary hover:underline" href={`/deployments/${run.deploymentId}`}>{run.deploymentId}</Link></p> : null}
    </div>
  </>;
}
