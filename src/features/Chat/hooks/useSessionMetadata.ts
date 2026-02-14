import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import { useCallback, useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";

export function useSessionMetadata() {
  const [sessionMetadata, setSessionMetadata] = useState<Record<string, ClawUISessionMetadata>>({});
  const [metaBusyByKey, setMetaBusyByKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    ipc.state
      .get()
      .then((state) => setSessionMetadata(state.sessions?.metadata ?? {}))
      .catch(() => {});
  }, []);

  const generateMetadata = useCallback(async (key: string) => {
    setMetaBusyByKey((m) => ({ ...m, [key]: true }));
    try {
      const meta = await ipc.metadata.generate(key);
      setSessionMetadata((prev) => ({ ...prev, [key]: meta }));
    } finally {
      setMetaBusyByKey((m) => ({ ...m, [key]: false }));
    }
  }, []);

  return { sessionMetadata, metaBusyByKey, generateMetadata } as const;
}
