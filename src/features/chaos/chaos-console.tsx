"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CHAOS_EXPERIMENT_TYPES, type ChaosExperimentType, type ChaosRun } from "@/types/domain";

const experimentOptions: { value: ChaosExperimentType; label: string }[] = [
  { value: "pod-failure", label: "Pod failure" }, { value: "rpc-failure", label: "RPC failure" },
  { value: "network-latency", label: "Network latency" }, { value: "packet-loss", label: "Packet loss" },
  { value: "cpu-stress", label: "CPU stress" }, { value: "memory-pressure", label: "Memory pressure" },
  { value: "db-failure", label: "Database failure" }, { value: "traffic-spike", label: "Traffic spike" },
  { value: "deployment-regression", label: "Deployment regression" },
];

interface ChaosServiceOption { id: string; name: string; environment: string }

export function ChaosConsole({ services, runs }: { services: ChaosServiceOption[]; runs: ChaosRun[] }) {
  const router = useRouter();
  const [type, setType] = useState<ChaosExperimentType>("rpc-failure");
  const [targetServiceId, setTargetServiceId] = useState(services[0]?.id ?? "");
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [intensity, setIntensity] = useState(2);
  const [productionConfirmed, setProductionConfirmed] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const active = runs.some((run) => run.status === "running");
  const selectedService = services.find((service) => service.id === targetServiceId);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 2_000);
    return () => clearInterval(timer);
  }, [active, router]);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("start");
    setMessage("");
    try {
      const response = await fetch("/api/chaos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, targetServiceId, durationSeconds, intensity, productionConfirmed }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not start the simulated experiment.");
      setMessage("Simulated experiment started; telemetry is updating.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start the experiment."); }
    finally { setBusyId(""); }
  }

  async function act(run: ChaosRun, action: "abort" | "promote") {
    setBusyId(run.id);
    setMessage("");
    try {
      const response = await fetch(`/api/chaos/${run.businessId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Action failed.");
      setMessage(action === "promote" ? "Chaos result correlated to an incident." : "Experiment aborted and its simulated fault cleared.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); }
    finally { setBusyId(""); }
  }

  return <div className="space-y-4">
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <form onSubmit={(event) => void start(event)} className="space-y-3 border-y border-border py-4">
        <h2 className="text-sm font-semibold">New experiment</h2>
        <label className="grid gap-1 text-xs text-muted-foreground">Experiment<select value={type} onChange={(event) => { const selected = CHAOS_EXPERIMENT_TYPES.find((value) => value === event.target.value); if (selected) setType(selected); }} className="h-9 rounded border border-input bg-background px-2 text-sm text-foreground">{experimentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Target service<select value={targetServiceId} onChange={(event) => setTargetServiceId(event.target.value)} className="h-9 rounded border border-input bg-background px-2 text-sm text-foreground">{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.environment}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Duration<select value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))} className="h-9 rounded border border-input bg-background px-2 text-sm text-foreground"><option value={10}>10 seconds</option><option value={30}>30 seconds</option><option value={60}>60 seconds</option><option value={120}>120 seconds</option></select></label>
        <label className="grid gap-2 text-xs text-muted-foreground">Intensity <span className="font-mono text-foreground">{intensity} / 5</span><input type="range" min={1} max={5} step={1} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /></label>
        {selectedService?.environment === "production" && <label className="flex items-start gap-2 text-xs text-warning"><input type="checkbox" checked={productionConfirmed} onChange={(event) => setProductionConfirmed(event.target.checked)} /><span>Confirm simulated fault injection against a production-labeled target. No real infrastructure is contacted.</span></label>}
        <button disabled={active || busyId === "start" || !targetServiceId} className="h-9 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{busyId === "start" ? "Starting…" : active ? "Experiment already running" : "Start simulated run"}</button>
        {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      </form>
      <div className="border-y border-border py-4"><h2 className="mb-3 text-sm font-semibold">Experiment history</h2>{runs.length ? <div className="space-y-0">{runs.map((run) => <article key={run.id} className="border-t border-border/60 py-3 first:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{run.businessId} · {run.type.replaceAll("-", " ")}</p><p className="text-xs text-muted-foreground">{run.targetServiceName} · intensity {run.intensity} · radius {run.blastRadiusServiceIds.length} service(s)</p></div><span className={`text-xs font-semibold capitalize ${run.status === "running" ? "text-warning" : run.status === "completed" ? "text-success" : "text-muted-foreground"}`}>{run.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{run.expectedImpact} · {new Date(run.startedAt).toLocaleTimeString()}</p>{run.result && <p className="mt-1 text-xs">{run.result}</p>}{run.incidentId && <a className="mt-1 inline-block text-xs text-primary" href={`/incidents/${run.incidentId}`}>Incident linked</a>}{run.status === "running" && <div className="mt-2 flex gap-3"><button disabled={busyId === run.id} onClick={() => void act(run, "abort")} className="text-xs text-destructive">Abort and restore</button><button disabled={busyId === run.id} onClick={() => void act(run, "promote")} className="text-xs text-primary">Promote to incident</button></div>}</article>)}</div> : <p className="text-sm text-muted-foreground">No experiment runs yet.</p>}</div>
    </section>
  </div>;
}
