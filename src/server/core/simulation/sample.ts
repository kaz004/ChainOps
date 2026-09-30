/**
 * Point-in-time metric sampling — the single metrics module. Deterministic
 * per (entityId, kind, bucket): same inputs → same value (spec §46).
 */

import { hashSeed, mulberry32 } from "./prng";

export type SeriesKind =
  | "request-rate"
  | "error-rate"
  | "latency-p50"
  | "latency-p95"
  | "latency-p99"
  | "cpu"
  | "memory"
  | "network"
  | "db-connections"
  | "queue-depth";

/** Healthy baseline per service (believable telemetry, spec §65). */
export interface BaselineProfile {
  requestRatePerMin: number;
  errorRatePct: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  cpuPct: number;
  memoryPct: number;
}

/** Multipliers applied while a failure is active (spec §48). */
export interface FailureProfile {
  errorRateMultiplier: number;
  latencyMultiplier: number;
}

export const DEFAULT_PROFILE: BaselineProfile = {
  requestRatePerMin: 12480,
  errorRatePct: 0.018,
  latencyP50Ms: 86,
  latencyP95Ms: 210,
  latencyP99Ms: 480,
  cpuPct: 61,
  memoryPct: 68,
};

export const DEFAULT_FAILURE: FailureProfile = {
  errorRateMultiplier: 1,
  latencyMultiplier: 1,
};

export function sampleNow(
  entityId: string,
  kind: SeriesKind,
  profile: BaselineProfile,
  failure: FailureProfile,
  atMs: number = Date.now(),
): number {
  const bucket = Math.floor(atMs / 300_000); // 5-min correlation bucket
  const drift = mulberry32(hashSeed(`${entityId}:${bucket}`))();
  const jitterRand = mulberry32(hashSeed(`${entityId}:${kind}:${bucket}`));

  const value = baseValue(kind, profile);
  const correlated = applyProfileShape(kind, value, drift);
  const failed = applyFailure(kind, correlated, failure);
  return round2(jitter(failed, jitterRand, 0.08));
}

function baseValue(kind: SeriesKind, profile: BaselineProfile): number {
  switch (kind) {
    case "request-rate":
      return profile.requestRatePerMin;
    case "error-rate":
      return profile.errorRatePct;
    case "latency-p50":
      return profile.latencyP50Ms;
    case "latency-p95":
      return profile.latencyP95Ms;
    case "latency-p99":
      return profile.latencyP99Ms;
    case "cpu":
      return profile.cpuPct;
    case "memory":
      return profile.memoryPct;
    case "network":
      return profile.requestRatePerMin * 0.9;
    case "db-connections":
      return 42;
    case "queue-depth":
      return 12;
  }
}

function applyProfileShape(kind: SeriesKind, value: number, drift: number): number {
  switch (kind) {
    case "request-rate":
      return value * (0.92 + drift * 0.16);
    case "cpu":
      return value * (0.95 + drift * 0.1);
    case "memory":
      return value * (0.98 + drift * 0.04);
    default:
      return value;
  }
}

function applyFailure(kind: SeriesKind, value: number, failure: FailureProfile): number {
  switch (kind)  {
    case "error-rate":
      return value * failure.errorRateMultiplier;
    case "latency-p50":
    case "latency-p95":
    case "latency-p99":
      return value * failure.latencyMultiplier;
    default:
      return value;
  }
}

function jitter(value: number, rand: () => number, spread: number): number {
  const factor = 1 + (rand() * 2 - 1) * spread;
  return value * factor;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
