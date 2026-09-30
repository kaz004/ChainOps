"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime, shortSha } from "@/lib/format";
import type { Deployment } from "@/types/domain";

type ProjectOption = { id: string; name: string; services: { id: string; name: string }[] };

const VARIANTS: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  success: "success", failed: "error", rolled_back: "warning", cancelled: "default",
  canary: "warning", verifying: "info", running: "info", queued: "default",
  rollback_pending: "warning", rolling_back: "warning",
};

export function DeploymentCenter({ initial, projects }: { initial: Deployment[]; projects: ProjectOption[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(projects[0]?.services[0]?.id ?? "");
  const [version, setVersion] = useState("v1.0.0");
  const [gitSha, setGitSha] = useState("a1b2c3d4");
  const [environment, setEnvironment] = useState("staging");
  const [failureStep, setFailureStep] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const selectedProject = projects.find((project) => project.id === projectId);
  const hasActive = items.some((item) => item.isSimulatedRun && ["queued", "running", "canary", "verifying"].includes(item.status));
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/deployments?page=1&pageSize=50", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json() as { data: Deployment[] };
          setItems(payload.data);
        }
      } catch {
        // The next interval retries transient request failures.
      }
    }, 1_500);
    return () => clearInterval(timer);
  }, [hasActive]);
  const visible = useMemo(() => items.filter((item) =>
    (!statusFilter || item.status === statusFilter) &&
    (!environmentFilter || item.environment === environmentFilter) &&
    (!search || `${item.businessId} ${item.serviceName} ${item.version} ${item.gitSha}`.toLowerCase().includes(search.toLowerCase())),
  ), [items, statusFilter, environmentFilter, search]);

  async function createDeployment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/deployments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, serviceId, version, gitSha, environment, simulatedFailureStep: failureStep || null }),
      });
      const payload = await response.json() as { data?: Deployment; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Could not queue deployment");
      const created = payload.data;
      setItems((current) => [created, ...current]);
      router.push(`/deployments/${created.businessId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not queue deployment");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-info">Simulated</span>
        <span>Deployments advance deterministically in this demo. No repository, build system, or infrastructure is contacted.</span>
      </div>

      <Card>
        <CardHeader><CardTitle>Queue deployment</CardTitle></CardHeader>
        <CardContent>
          {projects.length ? <form onSubmit={createDeployment} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Project
              <select className="h-9 rounded-md border border-input bg-background px-2 text-foreground" value={projectId} onChange={(event) => { const next = projects.find((project) => project.id === event.target.value); setProjectId(event.target.value); setServiceId(next?.services[0]?.id ?? ""); }}>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Service
              <select className="h-9 rounded-md border border-input bg-background px-2 text-foreground" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                {selectedProject?.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Version<Input value={version} onChange={(event) => setVersion(event.target.value)} required /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Commit SHA<Input value={gitSha} onChange={(event) => setGitSha(event.target.value)} minLength={8} maxLength={8} required /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Environment
              <select className="h-9 rounded-md border border-input bg-background px-2 text-foreground" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                <option value="staging">Staging</option><option value="production">Production</option><option value="development">Development</option>
              </select>
            </label>
            <div className="flex items-end"><Button type="submit" disabled={creating || !serviceId}><Play aria-hidden />{creating ? "Queuing…" : "Queue"}</Button></div>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">Demo failure scenario (optional)
              <select className="h-9 rounded-md border border-input bg-background px-2 text-foreground" value={failureStep} onChange={(event) => setFailureStep(event.target.value)}>
                <option value="">No injected failure</option><option>Tests passed</option><option>Security scan</option><option>Image built</option><option>Image pushed</option><option>Infrastructure validated</option><option>Canary started</option><option>Health checks</option><option>Traffic shifted</option>
              </select>
            </label>
          </form> : <p className="text-xs text-muted-foreground">No active project with deployable services.</p>}
          {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Search<Input aria-label="Search deployments" placeholder="Service, version, ID…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Status
            <select aria-label="Filter by status" className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{["queued", "running", "canary", "verifying", "success", "failed", "rollback_pending", "rolling_back", "rolled_back", "cancelled"].map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Environment
            <select aria-label="Filter by environment" className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground" value={environmentFilter} onChange={(event) => setEnvironmentFilter(event.target.value)}><option value="">All environments</option>{["production", "staging", "development"].map((value) => <option key={value}>{value}</option>)}</select>
          </label>
          <p className="ml-auto pb-2 text-xs text-muted-foreground">{visible.length} deployments</p>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Deployment</TableHead><TableHead>Environment</TableHead><TableHead>Commit</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
          <TableBody>{visible.map((item) => <TableRow key={item.id}>
            <TableCell><Link href={`/deployments/${item.businessId}`} className="font-medium hover:text-primary">{item.serviceName} <span className="font-mono text-muted-foreground">{item.version}</span></Link><div className="font-mono text-[10px] text-muted-foreground">{item.businessId}</div></TableCell>
            <TableCell className="text-xs capitalize">{item.environment}</TableCell><TableCell className="font-mono text-xs">{shortSha(item.gitSha)}</TableCell>
            <TableCell><Badge variant={VARIANTS[item.status]}>{item.status.replace(/_/g, " ")}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{formatRelativeTime(item.updatedAt)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {visible.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">No deployments match these filters.</p> : null}
      </section>
    </div>
  );
}
