/**
 * Deterministic PRNG (mulberry32). Same seed → same sequence, so demo data
 * and generated series never "randomly change" between page loads (spec §46).
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), t ^ (t >>> 16))) | 0;
    return ((t ^ (t >>> 13)) >>> 0) / 4294967296;
  };
}

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: number): () => number {
  return mulberry32(hashSeed(String(seed)));
}
