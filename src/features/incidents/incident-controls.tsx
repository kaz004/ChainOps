"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IncidentStatus } from "@/types/domain";

export function IncidentControls({ id, transitions }: { id: string; transitions: IncidentStatus[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function move(status: IncidentStatus) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/incidents/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "transition", status }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not update incident.");
      setMessage(`Incident moved to ${status}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update incident.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="flex flex-wrap items-center gap-2">{transitions.map((status) => <button key={status} disabled={busy} onClick={() => void move(status)} className="h-8 rounded border border-input px-3 text-xs capitalize hover:bg-accent disabled:opacity-50">Move to {status}</button>)}{message && <span role="status" className="text-xs text-muted-foreground">{message}</span>}</div>;
}

export function DetectIncidentsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function detect() {
    setBusy(true);
    try {
      const response = await fetch("/api/incidents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "detect" }) });
      const result = await response.json() as { data?: { alerts: unknown[]; incidents: unknown[] }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Detection failed.");
      setMessage(`Created ${result.data?.alerts.length ?? 0} alert(s) and ${result.data?.incidents.length ?? 0} incident(s).`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Detection failed.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="flex items-center gap-3"><button disabled={busy} onClick={() => void detect()} className="h-9 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? "Evaluating…" : "Evaluate telemetry"}</button>{message && <span role="status" className="text-xs text-muted-foreground">{message}</span>}</div>;
}
