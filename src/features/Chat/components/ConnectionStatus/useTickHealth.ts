import { useEffect, useState } from "react";

export type TickHealth = "unknown" | "healthy" | "delayed" | "timeout";

export function useTickHealth(lastTickAt: number | null, intervalMs: number): TickHealth {
  const [gap, setGap] = useState(0);

  useEffect(() => {
    if (!lastTickAt) return;
    setGap(Date.now() - lastTickAt);
    const t = setInterval(() => setGap(Date.now() - lastTickAt), 1000);
    return () => clearInterval(t);
  }, [lastTickAt]);

  if (!lastTickAt) return "unknown";
  if (gap < intervalMs * 1.5) return "healthy";
  if (gap < intervalMs * 2) return "delayed";
  return "timeout";
}

export function useTickGapSeconds(lastTickAt: number | null): number | null {
  const [gap, setGap] = useState<number | null>(null);

  useEffect(() => {
    if (!lastTickAt) {
      setGap(null);
      return;
    }
    setGap(Math.round((Date.now() - lastTickAt) / 1000));
    const t = setInterval(() => setGap(Math.round((Date.now() - lastTickAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastTickAt]);

  return gap;
}
