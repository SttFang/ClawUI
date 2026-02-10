export function createWeakCachedSelector<TState extends object, TResult>(
  compute: (state: TState) => TResult,
): (state: TState) => TResult {
  // React 19 + useSyncExternalStore can re-run selectors frequently; when a selector
  // returns new references (arrays/objects) for the same snapshot object, it may
  // trigger unnecessary updates or even loops. Cache per snapshot identity.
  const cache = new WeakMap<TState, TResult>();

  return (state: TState) => {
    if (cache.has(state)) return cache.get(state) as TResult;
    const result = compute(state);
    cache.set(state, result);
    return result;
  };
}
