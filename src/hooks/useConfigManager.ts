import { useEffect, useState } from "react";

type PathValue = string | number | boolean;

interface PathMapping {
  path: (string | number)[];
  default: PathValue;
}

interface ConfigManagerApi {
  loadSnapshot: () => Promise<void>;
  getPath: (path: (string | number)[]) => unknown;
  applyPathPatches: (patches: { path: (string | number)[]; value: PathValue }[]) => Promise<void>;
}

export function useConfigManager<K extends string>(opts: {
  manager: ConfigManagerApi;
  paths: Record<K, PathMapping>;
  messages?: { loadFailed: string };
}) {
  type Fields = Record<K, PathValue>;
  const keys = Object.keys(opts.paths) as K[];

  const buildDefaults = (): Fields => {
    const out = {} as Fields;
    for (const k of keys) out[k] = opts.paths[k].default;
    return out;
  };

  const [fields, setFields] = useState<Fields>(buildDefaults);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void opts.manager
      .loadSnapshot()
      .then(() => {
        if (!mounted) return;
        const next = {} as Fields;
        for (const k of keys) {
          const raw = opts.manager.getPath(opts.paths[k].path);
          next[k] =
            typeof raw === typeof opts.paths[k].default
              ? (raw as PathValue)
              : opts.paths[k].default;
        }
        setFields(next);
      })
      .catch((error) => {
        if (!mounted) return;
        setMessage(
          error instanceof Error ? error.message : (opts.messages?.loadFailed ?? "Load failed"),
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.manager]);

  const setField = <F extends K>(key: F, value: Fields[F]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const apply = (callbacks?: { onSuccess?: () => void; onError?: (msg: string) => void }) => {
    setLoading(true);
    setMessage(null);
    const patches = keys.map((k) => ({ path: opts.paths[k].path, value: fields[k] }));
    void opts.manager
      .applyPathPatches(patches)
      .then(() => callbacks?.onSuccess?.())
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Apply failed";
        setMessage(msg);
        callbacks?.onError?.(msg);
      })
      .finally(() => setLoading(false));
  };

  return { fields, setField, loading, message, setMessage, apply };
}
