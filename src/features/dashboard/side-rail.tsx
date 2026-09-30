import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import { formatExactTime, formatRelativeTime } from "@/lib/format";
import type { ChainStatusRow, IncidentSummaryRow } from "@/server/services/dashboard-service";

/** Right rail: chain health + open incidents (spec §12). */
export function SideRail({
  chainStatus,
  incidents,
}: {
  chainStatus: ChainStatusRow[];
  incidents: IncidentSummaryRow[];
}) {
  const severityVariant = (s: string) =>
    s === "sev-1" || s === "sev-2" ? ("error" as const) : s === "sev-3" ? ("warning" as const) : ("info" as const);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Chain health</CardTitle>
          <Link href="/chains" className="text-[11px] text-muted-foreground hover:text-primary">View all</Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {chainStatus.map((c) => (
            <div key={c.network} className="flex items-center justify-between">
              <span className="text-xs font-medium capitalize">{c.network}</span>
              <Status status={c.status} dense label={c.status} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Open incidents</CardTitle>
          <Link href="/incidents" className="text-[11px] text-muted-foreground hover:text-primary">View all</Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {incidents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open incidents.</p>
          ) : (
            incidents.map((i) => (
              <div key={i.id} className="rounded-md border border-border/70 p-2.5">
                <div className="flex items-center gap-2">
                  <Badge variant={severityVariant(i.severity)}>{i.severity.toUpperCase()}</Badge>
                  <span className="font-data text-[11px] text-muted-foreground">{i.id}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground" title={formatExactTime(i.detectedAt)}>
                    {formatRelativeTime(i.detectedAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-medium">{i.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{i.serviceNames.join(", ")}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
