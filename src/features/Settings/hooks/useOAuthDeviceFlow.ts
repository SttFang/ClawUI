import { useCallback, useRef, useState } from "react";
import { useClipboard } from "@/hooks/useClipboard";
import { ipc } from "@/lib/ipc";

export type OAuthDeviceFlowPhase = "idle" | "requesting" | "waiting" | "success" | "error";

export function useOAuthDeviceFlow(opts: {
  provider: string;
  onSuccess?: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { provider, onSuccess, onOpenChange } = opts;

  const [phase, setPhase] = useState<OAuthDeviceFlowPhase>("idle");
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef(false);
  const { copied, copy } = useClipboard();

  const reset = useCallback(() => {
    setPhase("idle");
    setUserCode("");
    setVerificationUri("");
    setErrorMessage("");
    abortRef.current = false;
  }, []);

  const startFlow = useCallback(async () => {
    abortRef.current = false;
    setPhase("requesting");
    setErrorMessage("");

    try {
      const info = await ipc.credentials.oauthDeviceStart(provider);
      if (abortRef.current) return;

      setUserCode(info.userCode);
      setVerificationUri(info.verificationUri);
      setPhase("waiting");

      try {
        await ipc.credentials.oauthDevicePoll(provider, info.deviceCode, info.interval);
        if (abortRef.current) return;
        setPhase("success");
        onSuccess?.();
      } catch (pollErr) {
        if (abortRef.current) return;
        setPhase("error");
        setErrorMessage(pollErr instanceof Error ? pollErr.message : String(pollErr));
      }
    } catch (err) {
      if (abortRef.current) return;
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [provider, onSuccess]);

  const handleCopy = useCallback(() => {
    void copy(userCode);
  }, [copy, userCode]);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        abortRef.current = true;
        reset();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  return {
    phase,
    userCode,
    verificationUri,
    errorMessage,
    copied,
    startFlow,
    handleCopy,
    handleClose,
  };
}
