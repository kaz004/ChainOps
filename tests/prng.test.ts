import { describe, expect, it } from "vitest";
import { hashSeed, mulberry32 } from "@/server/core/simulation/prng";
import {
  DEFAULT_FAILURE,
  DEFAULT_PROFILE,
  sampleNow,
} from "@/server/core/simulation/sample";

describe("PRNG determinism", () => {
  it("produces identical sequences for identical seeds", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(hashSeed("svc-a"));
    const b = mulberry32(hashSeed("svc-b"));
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("stays within [0,1)", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("metric sampling", () => {
  it("is deterministic for the same instant", () => {
    const t = Date.parse("2026-09-30T12:00:00Z");
    const a = sampleNow("svc-checkout-api", "latency-p50", DEFAULT_PROFILE, DEFAULT_FAILURE, t);
    const b = sampleNow("svc-checkout-api", "latency-p50", DEFAULT_PROFILE, DEFAULT_FAILURE, t);
    expect(a).toBe(b);
  });

  it("applies failure multipliers to latency and errors", () => {
    const t = Date.parse("2026-09-30T12:00:00Z");
    const healthy = sampleNow("svc-x", "latency-p95", DEFAULT_PROFILE, DEFAULT_FAILURE, t);
    const failing = sampleNow("svc-x", "latency-p95", DEFAULT_PROFILE, { errorRateMultiplier: 1, latencyMultiplier: 26 }, t);
    expect(failing).toBeGreaterThan(healthy * 10);
  });

  it("keeps healthy error rate small", () => {
    const t = Date.parse("2026-09-30T12:00:00Z");
    const err = sampleNow("svc-x", "error-rate", DEFAULT_PROFILE, DEFAULT_FAILURE, t);
    expect(err).toBeLessThan(1);
  });
});
