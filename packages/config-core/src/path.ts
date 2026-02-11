import type { ConfigPath, ConfigPathSegment } from "./types";

function toNumericPathSegment(value: string): ConfigPathSegment {
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return value;
}

export function normalizeConfigPath(path: string | ConfigPath): Array<ConfigPathSegment> {
  if (typeof path !== "string") {
    return [...path];
  }
  return path
    .split(".")
    .map((segment: string) => segment.trim())
    .filter(Boolean)
    .map(toNumericPathSegment);
}

function readObjectValue(source: unknown, key: string | number): unknown {
  if (typeof key === "number") {
    return Array.isArray(source) ? source[key] : undefined;
  }
  if (!source || typeof source !== "object") {
    return undefined;
  }
  return (source as Record<string, unknown>)[key];
}

export function getConfigPathValue(source: unknown, path: string | ConfigPath): unknown {
  const segments = normalizeConfigPath(path);
  let cursor: unknown = source;
  for (const segment of segments) {
    cursor = readObjectValue(cursor, segment);
    if (cursor === undefined) {
      return undefined;
    }
  }
  return cursor;
}
