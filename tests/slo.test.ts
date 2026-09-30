import { describe, expect, it } from "vitest";
import {
  burnRate,
  clamp,
  computeErrorBudget,
  errorBudgetRemainingPct,
  evaluateSli,
  sloTargetSchema,
} from "@/server/core/domain/slo";

describe("error budget", () => {
  it("computes remaining budget from target and observed", () => {
    // target 99.9 → budget 0.1; observed 99.97 consumed 0.03 → 70% left
    expect(errorBudgetRemainingPct(99.9, 99.97)).toBeCloseTo(70, 5);
  });

  it("returns 0 when budget is exhausted", () => {
    expect(errorBudgetRemainingPct(99.9, 99.85)).toBe(0);
  });

  it("returns 100 when observed is perfect", () => {
    expect(errorBudgetRemainingPct(99.9, 100)).toBeCloseTo(100, 5);
  });

  it("clamps into range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});

describe("burn rate", () => {
  it("is 1.0 when consuming at exactly the even pace", () => {
    const evenPaceErrorRatePct = 100 - 99.9;
    expect(burnRate(evenPaceErrorRatePct, 99.9, 1)).toBeCloseTo(1, 5);
    expect(burnRate(evenPaceErrorRatePct, 99.9, 6)).toBeCloseTo(1, 5);
  });

  it("scales linearly with error rate", () => {
    const r = burnRate(0.2, 99.9, 1);
    expect(r).toBeCloseTo(burnRate(0.1, 99.9, 1) * 2, 5);
  });

  it("rejects invalid SLO targets and marks invalid windows as unbounded burn", () => {
    expect(sloTargetSchema.safeParse(99.9).success).toBe(true);
    expect(sloTargetSchema.safeParse(100).success).toBe(false);
    expect(sloTargetSchema.safeParse(-1).success).toBe(false);
    expect(burnRate(0.1, 99.9, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("projected exhaustion exists only while burning above pace", () => {
    const slo = { id: "slo-1", targetPct: 99.9, kind: "availability" as const };
    // Even pace for 99.9/30d = 0.000138…%/h — 0.0001%/h is below pace (0.72×).
    const slow = computeErrorBudget(slo, 99.99, 0.0001);
    expect(slow.burnRate1h).toBeLessThan(1);
    expect(slow.projectedExhaustionAt).toBeNull();

    const fast = computeErrorBudget(slo, 99.95, 0.5);
    expect(fast.burnRate1h).toBeGreaterThan(1);
    expect(fast.projectedExhaustionAt).not.toBeNull();
  });

  it("flags exhausted budgets", () => {
    const slo = { id: "slo-1", targetPct: 99.9, kind: "availability" as const };
    const spent = computeErrorBudget(slo, 99.85, 0.5);
    expect(spent.remainingPct).toBe(0);
    expect(spent.consumedPct).toBe(100);
  });
});

describe("telemetry-backed SLI", () => {
  it("weights successful requests by sampled traffic and handles zero or missing traffic", () => {
    expect(evaluateSli("availability", [100, 300], [1, 2], []).observedPct).toBeCloseTo(98.25, 2);
    expect(evaluateSli("success-rate", [0, 0], [0, 0], []).window).toBe("insufficient");
    expect(evaluateSli("latency", [], [], []).observedPct).toBeNull();
  });

  it("calculates latency objective compliance from weighted request intervals", () => {
    const sli = evaluateSli("latency", [100, 300], [], [250, 450], 300);
    expect(sli.observedPct).toBe(25);
    expect(sli.requestVolume).toBe(400);
  });
});
