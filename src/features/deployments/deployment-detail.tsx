"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration, formatRelativeTime, shortSha } from "@/lib/format";
import type { Deployment } from "@/types/domain";

const ACTIVE = new Set(["queued", "running", "canary", "verifying", "rollback_pending", "rolling_back"]);
const STATUS_VARIANT: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  success: "success", failed: "error", rolled_back: "warning", cancelled: "default", canary: "warning", verifying: "info", running: "info", queued: "default", rollback_pending: "warning", rolling_back: "warning",
};

export function DeploymentDetail({ initial }: { initial: Deployment }) {
  const router = useRouter();
  const [deployment, setDeployment] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSimulatedRun = deployment.isSimulatedRun;
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/deployments/${deployment.businessId}`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json() as { data: Deployment };
        setDeployment(payload.data);
      }
    } catch {
      setError("Live deployment updates are temporarily unavailable.");
    }
  }, [deployment.businessId]);

  useEffect(() => {
    if (!isSimulatedRun || !ACTIVE.has(deployment.status)) return;
    const timer = setInterval(() => void refresh(), 1_000);
    return () => clearInterval(timer);
  }, [deployment.status, isSimulatedRun, refresh]);

  async function act(action: "cancel" | "retry" | "rollback") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/deployments/${deployment.businessId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const payload = await response.json() as { data?: Deployment; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? `Could not ${action} deployment`);
      if (action === "retry") router.push(`/deployments/${payload.data.businessId}`);
      setDeployment(payload.data);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${action} deployment`);
    } finally {
      setBusy(false);
    }
  }

  const canCancel = ["queued", "running", "canary"].includes(deployment.status);
  const canRollback = deployment.status === "failed";
  const canRetry = deployment.status === "failed" || deployment.status === "cancelled";

  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={STATUS_VARIANT[deployment.status]}>{deployment.status.replace(/_/g, " ")}</Badge>
      <Badge variant="outline" className="font-mono">{deployment.businessId}</Badge>
      <span className="text-xs text-muted-foreground">{deployment.environment} · commit {shortSha(deployment.gitSha)} · {deployment.triggeredByName}</span>
      <div className="ml-auto flex gap-2">
        {canCancel ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void act("cancel")}><Ban aria-hidden />Cancel</Button> : null}
        {canRollback ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void act("rollback")}><Undo2 aria-hidden />Rollback</Button> : null}
        {canRetry ? <Button size="sm" disabled={busy} onClick={() => void act("retry")}><RotateCcw aria-hidden />Retry</Button> : null}
      </div>
    </div>
    <div className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-muted-foreground"><span className="font-semibold text-info">Simulated provider</span> · {deployment.trigger === "manual" ? "Deterministic demo deployment; no infrastructure was contacted." : "Seeded demonstration record."}</div>
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}

    <Card><CardHeader><CardTitle>Release timeline</CardTitle></CardHeader><CardContent className="px-0 pb-2">
      <Table><TableHeader><TableRow><TableHead>Step</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead>Ended</TableHead></TableRow></TableHeader>
        <TableBody>{deployment.steps.map((step) => <TableRow key={step.id}><TableCell className="text-xs font-medium">{step.name}</TableCell><TableCell><Badge variant={step.status === "success" ? "success" : step.status === "failed" ? "error" : step.status === "running" ? "info" : "default"}>{step.status}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{step.startedAt ? formatRelativeTime(step.startedAt) : "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{step.endedAt ? formatRelativeTime(step.endedAt) : "—"}</TableCell></TableRow>)}</TableBody>
      </Table>
    </CardContent></Card>
    {deployment.canary ? <Card><CardHeader><CardTitle>Canary traffic</CardTitle></CardHeader><CardContent className="flex gap-6 text-xs"><span>Stable <strong>{deployment.canary.stablePct}%</strong></span><span>Canary <strong>{deployment.canary.canaryPct}%</strong></span></CardContent></Card> : null}
    <Card><CardHeader><CardTitle>Deployment logs</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">
      {deployment.logs.length ? deployment.logs.map((log) => <div key={log.id} className="grid grid-cols-[auto_1fr] gap-x-3 text-xs"><time className="font-mono text-muted-foreground">{new Date(log.at).toLocaleTimeString()}</time><span className={log.level === "error" ? "text-destructive" : log.level === "warning" ? "text-warning" : "text-foreground"}>{log.message}</span></div>) : <p className="text-xs text-muted-foreground">No deployment events recorded.</p>}
    </CardContent></Card>
    <p className="text-[11px] text-muted-foreground">Duration: {deployment.durationMs === null ? "in progress" : formatDuration(deployment.durationMs)} · last updated {formatRelativeTime(deployment.updatedAt)}</p>
  </div>;
}
