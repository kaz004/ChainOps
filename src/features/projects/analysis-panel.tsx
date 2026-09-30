"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2, CircleAlert, Clock, Info, Play, RefreshCw, ShieldCheck, Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { AnalysisFinding, FindingSeverity } from "@/server/core/ports/repository-analyzer";

// ── API view types (mirror server AnalysisJobView) ────────────────

interface AnalysisJobView {
  job: {
    id: string;
    businessId: string;
    status: "queued" | "running" | "complete" | "failed";
    repoUrl: string;
    ref: string;
    source: "demo-analysis" | "real-integration";
    analysis: AnalysisResult | null;
    error: string | null;
    finishedAt: string | null;
  };
  progressPct: number;
  currentStage: string | null;
  totalStages: number;
}

interface AnalysisResult {
  summary: {
    totalFindings: number;
    bySeverity: Record<string, number>;
    readiness: "ready" | "needs-work" | "at-risk";
  };
  application: {
    languages: { name: string; pct: number }[];
    frameworks: string[];
    services: { name: string; kind: string }[];
    dependencies: { name: string; version: string; kind: string; risk?: string; note?: string }[];
  };
  infrastructure: {
    docker: boolean; kubernetes: boolean; terraform: boolean; helm: boolean;
    cicd: string; notes: string[];
  };
  findings: AnalysisFinding[];
  commitSha: string;
  strengths?: string[];
}

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low", "info"];

const SEVERITY_BADGE: Record<string, "error" | "warning" | "info" | "default"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "info",
  info: "default",
};

// ── Panel ─────────────────────────────────────────────────────────

export function AnalysisPanel({
  slug,
  initial,
  canAnalyze,
  repoUrl,
  defaultBranch,
}: {
  slug: string;
  initial: AnalysisJobView | null;
  canAnalyze: boolean;
  repoUrl: string;
  defaultBranch: string;
}) {
  const [view, setView] = useState<AnalysisJobView | null>(initial);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll only while a job is in flight; stop on terminal state.
  const jobStatus = view?.job.status;
  useEffect(() => {
    if (jobStatus !== "running" && jobStatus !== "queued") {
      stopPolling();
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${slug}/analysis`, { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { data: AnalysisJobView | null };
        if (payload.data) setView(payload.data);
      } catch {
        // transient network error — keep polling
      }
    }, 1_000);
    return stopPolling;
  }, [jobStatus, slug, stopPolling]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: defaultBranch }),
      });
      const payload = (await res.json()) as { data?: AnalysisJobView; error?: { message: string } };
      if (!res.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Failed to start analysis");
      }
      setView(payload.data);
      toast({ kind: "info", title: "Analysis started", description: `${repoUrl}@${defaultBranch}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
    } finally {
      setStarting(false);
    }
  }

  const running = view?.job.status === "running" || view?.job.status === "queued";
  const complete = view?.job.status === "complete" && view.job.analysis !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* Provenance banner — Demo vs Real (spec §15/§72) */}
      <div className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/5 px-4 py-3">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
        <div className="text-xs">
          <p className="font-semibold text-foreground">
            {view?.job.source === "real-integration" ? "Real repository integration" : "Demo Analysis"}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {view?.job.source === "real-integration"
              ? "Results were produced by inspecting the connected repository."
              : "Results are generated by ChainOps’ deterministic demo analyzer from repository metadata — no GitHub repository was contacted or inspected. Connect a real analyzer integration to scan an actual repository."}
          </p>
        </div>
      </div>

      {/* Header row: repo + run control */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-foreground">{repoUrl}</p>
            <p className="text-[11px] text-muted-foreground">
              {view ? (
                <>commit <span className="font-mono">{view.job.analysis?.commitSha ?? "—"}</span> · ref <span className="font-mono">{view.job.ref}</span></>
              ) : (
                <>ref <span className="font-mono">{defaultBranch}</span> · never analyzed</>
              )}
            </p>
          </div>
          {canAnalyze ? (
            <Button onClick={start} disabled={starting || running}>
              {running ? (
                <>
                  <RefreshCw aria-hidden className="size-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Play aria-hidden className="size-4" /> {view ? "Re-analyze" : "Analyze repository"}
                </>
              )}
            </Button>
          ) : (
            <Badge variant="default">restore project to analyze</Badge>
          )}
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {/* Progress */}
      {view && running ? (
        <Card>
          <CardHeader>
            <CardTitle>Analysis in progress</CardTitle>
            <CardDescription>
              {view.job.businessId} · stage {Math.min((view.progressPct / 100) * view.totalStages + 1, view.totalStages).toFixed(0)} of {view.totalStages}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div
              role="progressbar"
              aria-valuenow={view.progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Analysis progress"
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${view.progressPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{view.currentStage ?? "Queued"}…</p>
          </CardContent>
        </Card>
      ) : null}

      {view?.job.status === "failed" ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-2.5 py-4">
            <CircleAlert aria-hidden className="mt-0.5 size-4 text-destructive" />
            <div>
              <p className="text-xs font-semibold">Analysis failed</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{view.job.error ?? "Unknown error"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Results */}
      {complete && view?.job.analysis ? (
        <AnalysisResults result={view.job.analysis} />
      ) : null}
    </div>
  );
}

// ── Results renderer ──────────────────────────────────────────────

function AnalysisResults({ result }: { result: AnalysisResult }) {
  const grouped = groupFindings(result.findings);
  const readinessBadge =
    result.summary.readiness === "ready" ? "success" : result.summary.readiness === "needs-work" ? "warning" : "error";

  return (
    <>
      {/* Summary tiles */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Analysis summary</CardTitle>
          <Badge variant={readinessBadge}>{result.summary.readiness}</Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Findings</p>
            <p className="font-data text-lg font-semibold">{result.summary.totalFindings}</p>
          </div>
          {SEVERITY_ORDER.map((sev) =>
            (result.summary.bySeverity[sev] ?? 0) > 0 ? (
              <div key={sev}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{sev}</p>
                <p className="font-data text-lg font-semibold">{result.summary.bySeverity[sev]}</p>
              </div>
            ) : null,
          )}
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 aria-hidden className="size-3.5 text-success" />
            {result.application.services.length} services · {result.application.dependencies.length} dependencies
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Findings */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          {Object.entries(grouped).map(([category, findings]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="capitalize">{category}</CardTitle>
                <CardDescription>
                  {findings.length} finding{findings.length === 1 ? "" : "s"} · sorted by severity
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {findings.map((f) => (
                  <details key={f.id} className="group rounded-md border border-border/70 open:bg-muted/30">
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-2.5 text-xs [&::-webkit-details-marker]:hidden">
                      <Badge variant={SEVERITY_BADGE[f.severity]}>{f.severity}</Badge>
                      <span className="min-w-0 flex-1 truncate font-medium">{f.title}</span>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] uppercase tracking-wide",
                          f.confidence.band === "high" ? "text-success" : f.confidence.band === "medium" ? "text-warning" : "text-muted-foreground",
                        )}
                        title={`Confidence ${Math.round(f.confidence.score * 100)}%`}
                      >
                        {f.confidence.band} confidence
                      </span>
                    </summary>
                    <div className="flex flex-col gap-2 border-t border-border/60 px-3 py-2.5 text-xs">
                      <p className="text-muted-foreground">{f.description}</p>
                      <EvidenceRow icon={Terminal} label="Evidence" value={f.evidence} />
                      <EvidenceRow icon={ShieldCheck} label="Recommendation" value={f.recommendation} />
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Application + infrastructure profile */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Application</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                {result.application.languages.map((l) => (
                  <div key={l.name} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 truncate">{l.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${l.pct}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right font-data text-[11px] text-muted-foreground">{l.pct}%</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.application.frameworks.map((f) => (
                  <Badge key={f} variant="outline">{f}</Badge>
                ))}
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Services detected</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.application.services.map((s) => (
                    <Badge key={s.name} variant="default"><span className="font-mono">{s.name}</span></Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Infrastructure</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <Capability label="Docker" ok={result.infrastructure.docker} />
                <Capability label="Kubernetes" ok={result.infrastructure.kubernetes} />
                <Capability label="Terraform" ok={result.infrastructure.terraform} />
                <Capability label="Helm" ok={result.infrastructure.helm} />
              </div>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Clock aria-hidden className="size-3" /> CI/CD: {result.infrastructure.cicd}
              </p>
              {result.infrastructure.notes.map((n) => (
                <p key={n} className="text-[11px] text-muted-foreground">• {n}</p>
              ))}
            </CardContent>
          </Card>

          {result.strengths && result.strengths.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>What looks good</CardTitle></CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1.5">
                  {result.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function EvidenceRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Terminal;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <p>
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-muted-foreground">{value}</span>
      </p>
    </div>
  );
}

function Capability({ label, ok }: { label: string; ok: boolean }) {
  return (
    <p className="flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 aria-hidden className="size-3.5 text-success" />
      ) : (
        <CircleAlert aria-hidden className="size-3.5 text-muted-foreground" />
      )}
      {label}
    </p>
  );
}

function groupFindings(findings: AnalysisFinding[]): Record<string, AnalysisFinding[]> {
  const groups: Record<string, AnalysisFinding[]> = {};
  for (const f of [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )) {
    (groups[f.category] ??= []).push(f);
  }
  return groups;
}
