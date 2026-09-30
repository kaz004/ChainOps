"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { RotateCcw, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function resetDemo() {
    setResetting(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      toast({ kind: "success", title: "Demo environment reset", description: "All seeded data restored." });
      setConfirmOpen(false);
      window.location.reload();
    } catch {
      toast({ kind: "error", title: "Reset failed", description: "Please try again." });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-6">
      <PageHeader title="Settings" description="Workspace configuration and demo controls." />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Acme Infrastructure · demo plan</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Environment mode</p>
                <p className="text-[11px] text-muted-foreground">All infrastructure is simulated for demonstration.</p>
              </div>
              <Badge variant="info">Demo / Simulation</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Users</p>
                <p className="text-[11px] text-muted-foreground">4 members · user management arrives with workspaces phase</p>
              </div>
              <Badge variant="outline">Owner: Adrian Vale</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-4 text-success" />
              Security
            </CardTitle>
            <CardDescription>Secrets are never displayed in ChainOps — only rotation status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">API keys</p>
                <p className="text-[11px] text-muted-foreground">2 keys active · last rotated 12 days ago</p>
              </div>
              <Badge variant="success">Healthy</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo environment</CardTitle>
            <CardDescription>
              Restores the seeded dataset: projects, deployments, incidents, chains and notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              <RotateCcw aria-hidden className="size-4" />
              Reset Demo Environment
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset demo environment?</DialogTitle>
            <DialogDescription>
              This restores the original seeded dataset. Any projects, deployments or incidents
              created during this session will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={resetDemo} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset demo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
