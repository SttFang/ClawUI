type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cloneDraftObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function ensureDraftObject(value: unknown): JsonObject {
  return isObject(value) ? cloneDraftObject(value) : {};
}

export function deepMergeDraft(target: JsonObject, patch: JsonObject): JsonObject {
  const result = cloneDraftObject(target);
  for (const [key, sourceValue] of Object.entries(patch)) {
    const currentValue = result[key];
    if (isObject(currentValue) && isObject(sourceValue)) {
      result[key] = deepMergeDraft(currentValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
}

export function setDraftPath(
  source: JsonObject,
  path: Array<string | number>,
  value: unknown,
): JsonObject {
  if (path.length === 0) return cloneDraftObject(source);

  const root = cloneDraftObject(source);
  let cursor: unknown = root;

  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (!isObject(cursor)) break;
    const current = cursor[key as keyof typeof cursor];
    if (isObject(current)) {
      cursor = current;
      continue;
    }
    const next: JsonObject = {};
    cursor[key as keyof typeof cursor] = next;
    cursor = next;
  }

  const last = path[path.length - 1];
  if (isObject(cursor)) {
    cursor[last as keyof typeof cursor] = value;
  }
  return root;
}
