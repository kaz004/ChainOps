import type { ErrorBudget, Slo } from "@/types/domain";
import { z } from "zod";

export const sloTargetSchema = z.number().finite().gt(0).lt(100);

export interface SliObservation {
  observedPct: number | null;
  requestVolume: number;
  sampleCount: number;
  window: "insufficient" | "observed";
}

export function evaluateSli(
  kind: Slo["kind"],
  requestRates: number[],
  errorRates: number[],
  p95Latencies: number[],
  latencyThresholdMs = 300,
): SliObservation {
  const count = Math.min(requestRates.length, kind === "latency" ? p95Latencies.length : errorRates.length);
  if (!count) return { observedPct: null, requestVolume: 0, sampleCount: 0, window: "insufficient" };
  const rates = requestRates.slice(-count);
  const requests = rates.reduce((sum, rate) => sum + Math.max(0, rate), 0);
  if (requests <= 0) return { observedPct: null, requestVolume: 0, sampleCount: count, window: "insufficient" };
  const observed = kind === "latency"
    ? rates.reduce((sum, rate, index) => sum + (p95Latencies.slice(-count)[index]! <= latencyThresholdMs ? Math.max(0, rate) : 0), 0) / requests * 100
    : rates.reduce((sum, rate, index) => sum + Math.max(0, rate) * (100 - Math.min(100, Math.max(0, errorRates.slice(-count)[index]!))), 0) / requests;
  return { observedPct: round2(observed), requestVolume: Math.round(requests), sampleCount: count, window: "observed" };
}

/**
 * SLO and error-budget math (docs/02 §2, spec §29/§30). Pure functions —
 * unit tested in tests/slo.test.ts.
 */

/**
 * Error budget remaining = (observed − target) / (100 − target).
 * E.g. target 99.9, observed 99.97 → 70% of budget left.
 */
export function errorBudgetRemainingPct(targetPct: number, observedPct: number): number {
  const slack = 100 - targetPct;
  if (slack <= 0) return 0;
  const remaining = ((observedPct - targetPct) / slack) * 100;
  return clamp(remaining, 0, 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Burn rate: how fast the budget is being consumed relative to even pace.
 * 1.0 = on pace to exactly exhaust the 30-day budget; 4.2 = 4.2× faster.
 * errorRatePct is the recent window's failure ratio (0–100).
 */
export function burnRate(errorRatePct: number, targetPct: number, windowHours: number): number {
  const budgetErrorPct = 100 - targetPct;
  if (budgetErrorPct <= 0 || windowHours <= 0 || !Number.isFinite(errorRatePct)) return Number.POSITIVE_INFINITY;
  return Math.max(0, errorRatePct) / budgetErrorPct;
}

export function computeErrorBudget(
  slo: Pick<Slo, "id" | "targetPct" | "kind">,
  observedPct: number,
  recentErrorRatePct: number,
  sixHourErrorRatePct = recentErrorRatePct,
): ErrorBudget {
  const remainingPct = errorBudgetRemainingPct(slo.targetPct, observedPct);
  const burn1h = burnRate(recentErrorRatePct, slo.targetPct, 1);
  const burn6h = burnRate(sixHourErrorRatePct, slo.targetPct, 6);
  // Projection uses the 1h burn rate: 1.0 = exactly even pace over the window.
  const paceBurn = burn1h > 0 ? burn1h : 0;

  let projectedExhaustionAt: ErrorBudget["projectedExhaustionAt"] = null;
  if (paceBurn > 1 && remainingPct > 0) {
    const daysLeft = remainingPct / 100 / paceBurn * 30;
    projectedExhaustionAt = new Date(Date.now() + daysLeft * 24 * 3600 * 1000).toISOString();
  }

  return {
    sloId: slo.id,
    targetPct: slo.targetPct,
    currentPct: observedPct,
    remainingPct,
    consumedPct: 100 - remainingPct,
    burnRate1h: round3(burn1h),
    burnRate6h: round3(burn6h),
    projectedExhaustionAt,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
