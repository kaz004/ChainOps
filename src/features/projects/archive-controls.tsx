"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

interface ArchiveControlsProps {
  slug: string;
  projectName: string;
  status: "active" | "archived";
}

/** Dangerous-action confirmation (spec §68): states what happens + affected scope. */
export function ArchiveControls({ slug, projectName, status }: ArchiveControlsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archiving = status === "active";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/${archiving ? "archive" : "restore"}`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "Request failed");
      }
      toast({
        kind: "success",
        title: archiving ? "Project archived" : "Project restored",
        description: archiving
          ? `${projectName} is now read-only.`
          : `${projectName} is active again.`,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={archiving ? "outline" : "default"} onClick={() => setOpen(true)}>
        {archiving ? (
          <>
            <Archive aria-hidden className="size-4" /> Archive
          </>
        ) : (
          <>
            <ArchiveRestore aria-hidden className="size-4" /> Restore
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{archiving ? `Archive ${projectName}?` : `Restore ${projectName}?`}</DialogTitle>
            <DialogDescription>
              {archiving
                ? "The project moves to archived status. Its services, deployments and SLOs remain visible but read-only; no new deployments can be triggered."
                : "The project returns to active status and can receive deployments again."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Affected:</span> project {projectName} and all
              associated services.
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">Risk:</span> low — reversible at any time.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant={archiving ? "destructive" : "default"} onClick={confirm} disabled={busy}>
              {busy ? "Working…" : archiving ? "Archive project" : "Restore project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
