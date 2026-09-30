import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatExactTime, formatRelativeTime, shortSha } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEvent, Deployment } from "@/types/domain";
import Link from "next/link";

// ── Deployments feed ──────────────────────────────────────────────

const DEPLOY_BADGE: Record<string, "success" | "error" | "info" | "warning"> = {
  success: "success",
  failed: "error",
  canary: "info",
  rolled_back: "warning",
  rolling_back: "warning",
  rollback_pending: "warning",
};

export function RecentDeployments({ deployments }: { deployments: Deployment[] }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent deployments</CardTitle>
        <Link href="/deployments" className="text-[11px] text-muted-foreground hover:text-primary">View all</Link>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Deployment</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>By</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link
                    href={`/deployments/${d.businessId}`}
                    className="font-data text-[13px] font-medium hover:text-primary hover:underline"
                  >
                    {d.businessId}
                  </Link>
                </TableCell>
                <TableCell className="text-xs">{d.serviceName}</TableCell>
                <TableCell className="font-data text-xs">{d.version}</TableCell>
                <TableCell className="font-data text-xs text-muted-foreground">{shortSha(d.gitSha)}</TableCell>
                <TableCell>
                  <Badge variant={DEPLOY_BADGE[d.status] ?? "info"}>{d.status.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell className="font-data text-xs">{d.durationMs ? formatDuration(d.durationMs) : "—"}</TableCell>
                <TableCell className="text-xs">{d.triggeredByName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <TimeAgo iso={d.createdAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Activity timeline ─────────────────────────────────────────────

const KIND_DOT: Record<string, string> = {
  incident: "bg-destructive",
  deployment: "bg-primary",
  slo: "bg-warning",
  chain: "bg-info",
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <span className="text-[11px] text-muted-foreground">operational timeline</span>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-3.5 border-l border-border/70 pl-4">
          {events.map((a) => (
            <li key={a.id} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[21px] top-1 size-2 rounded-full ring-2 ring-background",
                  KIND_DOT[a.kind] ?? "bg-muted-foreground/60",
                )}
              />
              <div className="flex items-baseline gap-2">
                <p className="text-xs font-medium">{a.title}</p>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  <TimeAgo iso={a.at} />
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{a.detail}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ── Shared: relative time with exact timestamp for screen readers ─

/**
 * Relative timestamp (spec §67); the exact time is visually hidden text so
 * screen readers get full precision and sighted users get the tooltip.
 */
function TimeAgo({ iso }: { iso: string }) {
  return (
    <span title={formatExactTime(iso)}>
      <span aria-hidden>{formatRelativeTime(iso)}</span>
      <span className="sr-only">{formatExactTime(iso)}</span>
    </span>
  );
}
