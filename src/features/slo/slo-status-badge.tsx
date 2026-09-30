import { Badge } from "@/components/ui/badge";
import type { SloWithBudget } from "@/server/services/slo-service";

/** Single mapping from SLO status to badge variant (spec §29/§30 semantics). */
export function SloStatusBadge({ status }: { status: SloWithBudget["status"] }) {
  const variant =
    status === "healthy" ? ("success" as const) : status === "at-risk" ? ("warning" as const) : ("error" as const);
  return <Badge variant={variant}>{status}</Badge>;
}
