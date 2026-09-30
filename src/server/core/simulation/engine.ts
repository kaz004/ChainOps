/**
 * Simulation engine (docs/01 §3). Phase 1 scope: failure-state registry for
 * chain RPC degradation, service health snapshots derived from sim state,
 * tick loop. Later phases extend ticks to deployment/incident progression.
 */

import type { ChaosExperimentType, HealthStatus, ServiceHealthSnapshot } from "@/types/domain";
import { simNow } from "./clock";
import {
  DEFAULT_FAILURE,
  DEFAULT_PROFILE,
  type BaselineProfile,
  type FailureProfile,
} from "./sample";
import { sampleNow } from "./sample";

export interface ChainFailureState {
  providerId: string;
  latencyMultiplier: number;
  errorRateMultiplier: number;
  injectedAtMs: number;
  active: boolean;
}

export interface ServiceSimState {
  profile: BaselineProfile;
  failure: FailureProfile;
}

export interface SnapshotOptions {
  touchesChains?: boolean;
  /** Service is in the blast radius of an active incident → full impact. */
  affectedByIncident?: boolean;
}

export interface EngineStatus {
  running: boolean;
  simTime: string;
  tickCount: number;
  activeFailures: number;
}

export interface ChaosModifiers {
  errorRateMultiplier: number;
  latencyMultiplier: number;
  cpuMultiplier: number;
  memoryMultiplier: number;
  requestRateMultiplier: number;
}

interface ActiveChaosEffect {
  runId: string;
  type: ChaosExperimentType;
  intensity: number;
  expiresAtMs: number;
}

export class SimulationEngine {
  private chainFailures = new Map<string, ChainFailureState>();
  private serviceStates = new Map<string, ServiceSimState>();
  private chaosEffects = new Map<string, ActiveChaosEffect>();
  private tickCount = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  registerService(id: string, profile?: Partial<BaselineProfile>): void {
    this.serviceStates.set(id, {
      profile: { ...DEFAULT_PROFILE, ...profile },
      failure: { ...DEFAULT_FAILURE },
    });
  }

  getChainFailure(providerId: string): ChainFailureState | null {
    const f = this.chainFailures.get(providerId);
    return f && f.active ? f : null;
  }

  listChainFailures(): ChainFailureState[] {
    return [...this.chainFailures.values()].filter((f) => f.active);
  }

  /** Inject RPC failure (spec §48). Later phases trigger incidents from tick. */
  injectRpcFailure(providerId: string): ChainFailureState {
    const state: ChainFailureState = {
      providerId,
      latencyMultiplier: 26,
      errorRateMultiplier: 57,
      injectedAtMs: Date.now(),
      active: true,
    };
    this.chainFailures.set(providerId, state);
    return state;
  }

  clearRpcFailure(providerId: string): boolean {
    const existing = this.chainFailures.get(providerId);
    if (!existing) return false;
    existing.active = false;
    return true;
  }

  applyChaos(runId: string, type: ChaosExperimentType, serviceIds: string[], intensity: number, expiresAtMs: number): boolean {
    if (serviceIds.some((id) => this.chaosEffects.has(id))) return false;
    for (const serviceId of serviceIds) this.chaosEffects.set(serviceId, { runId, type, intensity, expiresAtMs });
    return true;
  }

  clearChaos(runId: string): void {
    for (const [serviceId, effect] of this.chaosEffects) {
      if (effect.runId === runId) this.chaosEffects.delete(serviceId);
    }
  }

  chaosModifiers(serviceId: string): ChaosModifiers {
    const effect = this.chaosEffects.get(serviceId);
    if (effect && Date.now() >= effect.expiresAtMs) {
      this.clearChaos(effect.runId);
      return this.chaosModifiers(serviceId);
    }
    const intensity = effect?.intensity ?? 0;
    const neutral: ChaosModifiers = { errorRateMultiplier: 1, latencyMultiplier: 1, cpuMultiplier: 1, memoryMultiplier: 1, requestRateMultiplier: 1 };
    if (!effect) return neutral;
    switch (effect.type) {
      case "pod-failure": return { ...neutral, errorRateMultiplier: 20 * intensity, latencyMultiplier: 5 * intensity };
      case "rpc-failure": return { ...neutral, errorRateMultiplier: 25 * intensity, latencyMultiplier: 12 * intensity };
      case "network-latency": return { ...neutral, errorRateMultiplier: 1 + 0.5 * intensity, latencyMultiplier: 3 * intensity };
      case "packet-loss": return { ...neutral, errorRateMultiplier: 8 * intensity, latencyMultiplier: 1.5 * intensity };
      case "cpu-stress": return { ...neutral, cpuMultiplier: 1 + 0.8 * intensity };
      case "memory-pressure": return { ...neutral, memoryMultiplier: 1 + 0.8 * intensity };
      case "db-failure": return { ...neutral, errorRateMultiplier: 20 * intensity, latencyMultiplier: 6 * intensity };
      case "traffic-spike": return { ...neutral, cpuMultiplier: 1 + 0.25 * intensity, requestRateMultiplier: 1 + 0.5 * intensity };
      case "deployment-regression": return { ...neutral, errorRateMultiplier: 6 * intensity, latencyMultiplier: 3 * intensity };
    }
  }

  /**
   * Service health snapshot derived from sim state. Services that touch
   * chains degrade when chain providers fail (phase 8 wires the full graph).
   */
  serviceSnapshot(
    serviceId: string,
    serviceName: string,
    projectId: string,
    opts: SnapshotOptions = {},
  ): ServiceHealthSnapshot {
    const state = this.serviceStates.get(serviceId) ?? {
      profile: DEFAULT_PROFILE,
      failure: DEFAULT_FAILURE,
    };

    const affected = opts.affectedByIncident === true;
    const touches = opts.touchesChains === true;
    const baseFailure: FailureProfile = affected
      ? { errorRateMultiplier: 600, latencyMultiplier: 8 }
      : touches
        ? { errorRateMultiplier: 2, latencyMultiplier: 1.5 }
        : state.failure;
    const chaos = this.chaosModifiers(serviceId);
    const failure: FailureProfile = {
      errorRateMultiplier: baseFailure.errorRateMultiplier * chaos.errorRateMultiplier,
      latencyMultiplier: baseFailure.latencyMultiplier * chaos.latencyMultiplier,
    };
    const profile: BaselineProfile = {
      ...state.profile,
      requestRatePerMin: state.profile.requestRatePerMin * chaos.requestRateMultiplier,
      cpuPct: state.profile.cpuPct * chaos.cpuMultiplier,
      memoryPct: state.profile.memoryPct * chaos.memoryMultiplier,
    };

    const p50 = Math.round(sampleNow(serviceId, "latency-p50", profile, failure));
    const p95 = Math.round(sampleNow(serviceId, "latency-p95", profile, failure));
    const p99 = Math.round(sampleNow(serviceId, "latency-p99", profile, failure));
    const errorRate = Math.min(100, sampleNow(serviceId, "error-rate", profile, failure));
    const requestRate = Math.round(sampleNow(serviceId, "request-rate", profile, failure));
    const cpu = Math.min(100, sampleNow(serviceId, "cpu", profile, failure));
    const memory = Math.min(100, sampleNow(serviceId, "memory", profile, failure));

    let status: HealthStatus = "healthy";
    if (errorRate > 5) status = "critical";
    else if (errorRate > 1 || p95 > 400) status = "degraded";

    return {
      serviceId,
      serviceName,
      projectId,
      status,
      availabilityPct: round2(100 - errorRate),
      requestRatePerMin: requestRate,
      errorRatePct: round2(errorRate),
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      cpuPct: round2(cpu),
      memoryPct: round2(memory),
    };
  }

  /** Advance simulation. Phase 1: tick counting only; later phases add flows. */
  tick(): void {
    this.tickCount += 1;
    const expired = new Set([...this.chaosEffects.values()].filter((effect) => Date.now() >= effect.expiresAtMs).map((effect) => effect.runId));
    expired.forEach((runId) => this.clearChaos(runId));
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000);
    if (typeof this.timer === "object" && this.timer !== null && "unref" in this.timer) {
      (this.timer as { unref(): void }).unref();
    }
    this.running = true;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }

  status(): EngineStatus {
    return {
      running: this.running,
      simTime: simNow(),
      tickCount: this.tickCount,
      activeFailures: this.listChainFailures().length,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
