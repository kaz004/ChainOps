/**
 * SimulationEngine singleton. Guarded on globalThis so Next dev HMR and
 * multiple route-module instances share one engine.
 */

import { SimulationEngine } from "./engine";
import { chainTouchingServiceIds, services } from "@/server/seed/demo-data";

const globalEngine = globalThis as unknown as { __chainopsEngine?: SimulationEngine };

export function getSimulationEngine(): SimulationEngine {
  if (!globalEngine.__chainopsEngine) {
    const engine = new SimulationEngine();
    for (const svc of services) {
      engine.registerService(svc.id);
    }
    // Seed the demo failure state: Base provider-b degraded (spec §64).
    engine.injectRpcFailure("rpc-base-b");
    engine.start();
    globalEngine.__chainopsEngine = engine;
  }
  return globalEngine.__chainopsEngine;
}

export { chainTouchingServiceIds };
