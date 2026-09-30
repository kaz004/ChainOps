/**
 * Virtual simulation clock (docs/01 §3): sim-time advances TIME_SCALE× real
 * time from a fixed epoch. Series generators sample this clock lazily.
 */

const TIME_SCALE = 60;

const epochRealMs = Date.now();

function elapsedSimMs(): number {
  return (Date.now() - epochRealMs) * TIME_SCALE;
}

/** Simulation time as epoch ms. */
export function simNowMs(): number {
  return epochRealMs + elapsedSimMs();
}

/** Current simulation wall-clock time (ISO 8601 UTC). */
export function simNow(): string {
  return new Date(simNowMs()).toISOString();
}
