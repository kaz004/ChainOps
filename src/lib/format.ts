/**
 * Central formatting (docs/03 §2). UI components never format ad hoc.
 */

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  const diffMs = now - then;
  const abs = Math.abs(diffMs);
  const suffix = diffMs >= 0 ? "ago" : "from now";

  const sec = Math.round(abs / 1000);
  if (sec < 45) return diffMs >= 0 ? "just now" : "in <1m";
  const minutes = Math.round(sec / 60);
  if (minutes < 60) return `${minutes}m ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ${suffix}`;
  const months = Math.round(days / 30);
  return `${months}mo ${suffix}`;
}

export function formatExactTime(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function formatPct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export function shortSha(sha: string): string {
  return sha.slice(0, 8);
}
