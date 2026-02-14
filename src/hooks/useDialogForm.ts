import { useCallback, useEffect, useState } from "react";

export function useDialogForm<T extends Record<string, unknown>>(opts: {
  config: Partial<T> | null | undefined;
  defaults: T;
  onSave: (values: T) => Promise<void>;
  onClose?: () => void;
  logger?: { error: (...args: unknown[]) => void };
}) {
  const [fields, setFields] = useState<T>(opts.defaults);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (opts.config) {
      setFields((prev) => ({ ...prev, ...opts.config }));
    }
  }, [opts.config]);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      await opts.onSave(fields);
      opts.onClose?.();
    } catch (error) {
      opts.logger?.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [fields, opts]);

  return { fields, setField, isLoading, handleSave };
}
