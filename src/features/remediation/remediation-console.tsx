"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { REMEDIATION_TYPES, type RemediationAction, type RemediationType } from "@/types/domain";

const labels: Record<RemediationType, string> = {
  "service-restart": "Service restart simulation",
  "rpc-failover": "RPC failover",
  "provider-disable": "Disable RPC provider",
  "deployment-rollback": "Deployment rollback",
};

interface Option { id: string; name: string }
interface TargetSets { services: Option[]; providers: (Option & { status: string })[]; deployments: Option[] }

export function RemediationConsole({ actions, targets }: { actions: RemediationAction[]; targets: TargetSets }) {
  const router = useRouter();
  const params = useSearchParams();
  const requestedType = REMEDIATION_TYPES.find((item) => item === params.get("type"));
  const [type, setType] = useState<RemediationType>(requestedType ?? "service-restart");
  const [targetId, setTargetId] = useState(params.get("targetId") ?? targets.services[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const choices: Option[] = useMemo(() => type === "service-restart"
    ? targets.services
    : type === "deployment-rollback"
      ? targets.deployments
      : targets.providers.filter((provider) => type !== "rpc-failover" || provider.status === "degraded" || provider.status === "down"), [targets, type]);

  useEffect(() => {
    if (!choices.some((choice) => choice.id === targetId)) setTargetId(choices[0]?.id ?? "");
  }, [choices, targetId]);

  async function propose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("propose");
    setMessage("");
    try {
      const response = await fetch("/api/remediations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, targetId, reason }) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Could not propose action.");
      setReason("");
      setMessage("Proposal recorded. It has not executed.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not propose action."); }
    finally { setBusy(""); }
  }

  async function act(action: RemediationAction, verb: "approve" | "reject" | "execute") {
    setBusy(action.id);
    setMessage("");
    try {
      const response = await fetch(`/api/remediations/${action.businessId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: verb }) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? `Could not ${verb} action.`);
      setMessage(`Action ${verb} request recorded.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : `Could not ${verb} action.`); }
    finally { setBusy(""); }
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
    <form onSubmit={(event) => void propose(event)} className="space-y-3 border-y border-border py-4"><h2 className="text-sm font-semibold">Propose an allowlisted action</h2>
      <label className="grid gap-1 text-xs text-muted-foreground">Action<select value={type} onChange={(event) => { const selected = REMEDIATION_TYPES.find((item) => item === event.target.value); if (selected) setType(selected); }} className="h-9 rounded border border-input bg-background px-2 text-sm text-foreground">{REMEDIATION_TYPES.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-muted-foreground">Target<select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="h-9 rounded border border-input bg-background px-2 text-sm text-foreground">{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-muted-foreground">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={300} required rows={3} className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground" placeholder="Describe the evidence and intended recovery" /></label>
      <p className="text-xs text-muted-foreground">Every action needs approval. High-risk actions require the owner role.</p>
      <button disabled={busy === "propose" || !targetId} className="h-9 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy === "propose" ? "Recording…" : "Create proposal"}</button>
    </form>
    <section><div className="flex flex-wrap items-end justify-between gap-2 border-b border-border py-3"><div><h2 className="text-sm font-semibold">Action ledger</h2><p className="text-xs text-muted-foreground">Demo principal: Adrian Vale (owner). Authentication is not implemented.</p></div><span className="text-[11px] text-warning">SIMULATED · no shell or external provider execution</span></div>
      {message && <p role="status" className="py-2 text-xs text-muted-foreground">{message}</p>}
      {actions.length ? actions.map((action) => <article key={action.id} className="border-b border-border/60 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{action.businessId} · {labels[action.type]}</p><p className="text-xs text-muted-foreground">{action.targetName} · {action.risk} risk · {action.policy}</p></div><span className={`text-xs font-semibold capitalize ${action.status === "succeeded" ? "text-success" : action.status === "failed" || action.status === "rejected" ? "text-destructive" : "text-warning"}`}>{action.status}</span></div><p className="mt-1 text-sm">{action.reason}</p><p className="mt-1 text-xs text-muted-foreground">{action.approvalRequired ? `Approval required${action.approvedBy ? ` · approved by ${action.approvedBy}` : ""}` : "Approval optional"}</p>{action.result && <p className="mt-2 text-xs">{action.result}</p>}
        {(action.status === "proposed" || action.status === "approved") && <div className="mt-2 flex flex-wrap gap-3">{action.status === "proposed" && <><button disabled={busy === action.id} onClick={() => void act(action, "approve")} className="text-xs text-primary">Approve</button><button disabled={busy === action.id} onClick={() => void act(action, "reject")} className="text-xs text-destructive">Reject</button></>}{action.status === "approved" && <button disabled={busy === action.id} onClick={() => void act(action, "execute")} className="text-xs text-primary">Execute approved action</button>}</div>}
        <details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Audit trail · {action.auditEvents.length} events</summary><ol className="mt-2 space-y-1">{action.auditEvents.map((event) => <li key={event.id} className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString()} · {event.kind} · {event.actor} · {event.detail}</li>)}</ol></details>
      </article>) : <p className="py-6 text-sm text-muted-foreground">No remediation proposals.</p>}
    </section>
  </div>;
}
