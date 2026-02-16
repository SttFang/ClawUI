import { useCallback, useEffect, useRef, useState } from "react";

function isSameConfig<T extends Record<string, unknown>>(
  prev: Partial<T> | null | undefined,
  next: Partial<T> | null | undefined,
) {
  if (prev === next) {
    return true;
  }

  if (!prev || !next) {
    return false;
  }

  const prevKeys = Object.keys(prev) as Array<keyof T>;
  const nextKeys = Object.keys(next) as Array<keyof T>;

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  return prevKeys.every((key) => Object.is(prev[key], next[key]));
}

export function useDialogForm<T extends Record<string, unknown>>(opts: {
  config: Partial<T> | null | undefined;
  defaults: T;
  onSave: (values: T) => Promise<void>;
  onClose?: () => void;
  logger?: { error: (...args: unknown[]) => void };
}) {
  const [fields, setFields] = useState<T>(opts.defaults);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedConfigRef = useRef<Partial<T> | null | undefined>(undefined);

  useEffect(() => {
    if (!opts.config) {
      lastSyncedConfigRef.current = opts.config;
      return;
    }

    if (isSameConfig(lastSyncedConfigRef.current, opts.config)) {
      return;
    }

    lastSyncedConfigRef.current = opts.config;
    setFields((prev) => {
      const next = { ...prev, ...opts.config } as T;
      const hasChanges = (Object.keys(next) as Array<keyof T>).some(
        (key) => !Object.is(prev[key], next[key]),
      );

      return hasChanges ? next : prev;
    });
  }, [opts.config]);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await opts.onSave(fields);
      opts.onClose?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      opts.logger?.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [fields, opts.logger, opts.onClose, opts.onSave]);

  return { fields, setField, isLoading, error, handleSave };
}
