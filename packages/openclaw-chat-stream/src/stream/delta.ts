export function computeSuffixDelta(prev: string, next: string): string {
  if (!next) return ''
  if (!prev) return next
  if (next.length <= prev.length) return ''
  if (next.startsWith(prev)) return next.slice(prev.length)
  // Best-effort: fall back to longest common prefix.
  const max = Math.min(prev.length, next.length)
  let i = 0
  while (i < max && prev.charCodeAt(i) === next.charCodeAt(i)) i++
  return next.slice(i)
}

