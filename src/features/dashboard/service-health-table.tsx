import Link from "next/link";
import { Status } from "@/components/ui/status";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import type { ServiceHealthSnapshot } from "@/types/domain";

function projectSlug(projectId: string): string {
  return projectId.replace(/^prj-/, "");
}

/** RED + utilization table for the dashboard (spec §12). */
export function ServiceHealthTable({ services }: { services: ServiceHealthSnapshot[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Service</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Req/min</TableHead>
          <TableHead className="text-right">Errors</TableHead>
          <TableHead className="text-right">p50</TableHead>
          <TableHead className="text-right">p95</TableHead>
          <TableHead className="text-right">p99</TableHead>
          <TableHead className="text-right">CPU</TableHead>
          <TableHead className="text-right">Mem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((s) => (
          <TableRow key={s.serviceId}>
            <TableCell>
              <Link
                href={`/projects/${projectSlug(s.projectId)}`}
                className="font-mono text-[13px] font-medium hover:text-primary hover:underline"
              >
                {s.serviceName}
              </Link>
            </TableCell>
            <TableCell><Status status={s.status} dense label={s.status} /></TableCell>
            <TableCell className="text-right font-data">{formatNumber(s.requestRatePerMin)}</TableCell>
            <TableCell className="text-right font-data">{s.errorRatePct.toFixed(2)}%</TableCell>
            <TableCell className="text-right font-data">{s.p50Ms}ms</TableCell>
            <TableCell className="text-right font-data">{s.p95Ms}ms</TableCell>
            <TableCell className="text-right font-data">{s.p99Ms}ms</TableCell>
            <TableCell className="text-right font-data">{s.cpuPct.toFixed(0)}%</TableCell>
            <TableCell className="text-right font-data">{s.memoryPct.toFixed(0)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
