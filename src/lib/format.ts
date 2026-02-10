/** Format large token counts with K/M suffixes. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Format a dollar cost with fixed decimal places (default 2). */
export function formatCost(n: number, decimals = 2): string {
  return `$${n.toFixed(decimals)}`
}

/** Format millisecond latency to human-readable string. */
export function formatLatency(ms: number | undefined): string {
  if (ms == null || ms === 0) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}
