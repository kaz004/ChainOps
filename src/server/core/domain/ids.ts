/**
 * Business ID generation with per-type monotonic counters.
 * Deterministic within a process; reset with the demo dataset.
 */

type CounterState = Map<string, number>;

const state: CounterState = new Map();

export function nextBusinessId(prefix: string): string {
  const current = state.get(prefix) ?? 1000;
  const next = current + 1;
  state.set(prefix, next);
  return `${prefix}-${next}`;
}

/** Seed a counter so generated IDs continue after the demo dataset. */
export function seedCounter(prefix: string, lastValue: number): void {
  state.set(prefix, lastValue);
}

/** Used by demo reset to restore baseline counters. */
export function resetCounters(seed: Record<string, number> = {}): void {
  state.clear();
  for (const [prefix, value] of Object.entries(seed)) {
    state.set(prefix, value);
  }
}
