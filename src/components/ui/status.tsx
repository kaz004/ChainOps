import { CheckCircle2, CircleAlert, CircleX, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/types/domain";

interface StatusProps {
  status: HealthStatus;
  label?: string;
  className?: string;
  /** Show dot instead of icon for dense tables. */
  dense?: boolean;
}

const MAP: Record<
  HealthStatus,
  { icon: typeof CheckCircle2; cls: string; label: string }
> = {
  healthy: { icon: CheckCircle2, cls: "text-success", label: "Healthy" },
  degraded: { icon: CircleAlert, cls: "text-warning", label: "Degraded" },
  critical: { icon: CircleX, cls: "text-destructive", label: "Critical" },
  unknown: { icon: CircleHelp, cls: "text-muted-foreground", label: "Unknown" },
};

/** Status is always icon + label + color (spec §10: never color alone). */
export function Status({ status, label, className, dense = false }: StatusProps) {
  const entry = MAP[status];
  const Icon = entry.icon;
  const text = label ?? entry.label;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", entry.cls, className)}>
      {dense ? (
        <span aria-hidden className={cn("size-1.5 rounded-full bg-current")} />
      ) : (
        <Icon aria-hidden className="size-3.5" />
      )}
      <span>{text}</span>
    </span>
  );
}
