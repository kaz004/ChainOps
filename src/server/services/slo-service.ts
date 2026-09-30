import type { ErrorBudget, Slo } from "@/types/domain";
import { getRepos } from "@/server/repositories/store";
import { computeErrorBudget, evaluateSli, type SliObservation } from "@/server/core/domain/slo";
import { NotFoundError } from "@/server/core/errors";
import type { TelemetryProvider } from "@/server/core/ports/telemetry-provider";

export interface SloWithBudget extends Slo {
  budget: ErrorBudget;
  sli: SliObservation;
  status: "healthy" | "at-risk" | "breached";
}

export class SloService {
  constructor(private readonly telemetryProvider: TelemetryProvider) {}

  listWithBudgets(): SloWithBudget[] {
    const repos = getRepos();
    const now = Date.now();
    const telemetry = this.telemetryProvider.read({ from: now - 6 * 60 * 60 * 1000, to: now });

    return repos.slos.all().map((slo) => {
      const metrics = telemetry.metrics.filter((metric) => metric.serviceId === slo.serviceId);
      const values = (kind: "request-rate" | "error-rate" | "latency-p95") => metrics.find((m) => m.kind === kind)?.points.map((p) => p.v) ?? [];
      const requests = values("request-rate");
      const errors = values("error-rate");
      const latencies = values("latency-p95");
      const sli = evaluateSli(slo.kind, requests, errors, latencies);
      const observed = sli.observedPct ?? slo.targetPct;
      const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      const budget = computeErrorBudget(slo, observed, average(errors.slice(-12)), average(errors));

      // "At-risk" uses the standard 1h fast-burn threshold (14.4×) or a
      // mostly-consumed budget — not merely burning above even pace.
      const status: SloWithBudget["status"] =
        sli.window === "insufficient"
          ? "at-risk"
          : budget.remainingPct <= 0
            ? "breached"
            : budget.remainingPct < 25 || budget.burnRate1h > 14.4
              ? "at-risk"
              : "healthy";

      return { ...slo, budget, sli, status };
    });
  }

  get(id: string): SloWithBudget {
    const all = this.listWithBudgets();
    const found = all.find((s) => s.id === id || s.businessId === id);
    if (!found) throw new NotFoundError("SLO", id);
    return found;
  }
}
