import { useEffect, useMemo, useState } from "react";
import type { useModelConfig } from "./useModelConfig";

function toCommaList(value: string[] | null | undefined): string {
  if (!value || value.length === 0) return "";
  return value.join(", ");
}

export function parseCommaList(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function useAuthOrderForm(config: ReturnType<typeof useModelConfig>) {
  const { selectedProvider, authOrderByProvider, loadAuthOrder } = config;

  const [fallbackInput, setFallbackInput] = useState("");
  const [authOrderInput, setAuthOrderInput] = useState("");
  const [authMethodInput, setAuthMethodInput] = useState("");

  useEffect(() => {
    const provider = selectedProvider.trim();
    if (!provider) return;
    void loadAuthOrder(provider);
  }, [loadAuthOrder, selectedProvider]);

  useEffect(() => {
    const current = authOrderByProvider[selectedProvider]?.order ?? null;
    setAuthOrderInput(toCommaList(current));
  }, [authOrderByProvider, selectedProvider]);

  const providerOptions = useMemo(
    () => config.status?.auth.providers.map((provider) => provider.provider).filter(Boolean) ?? [],
    [config.status],
  );

  const authOrderValue = authOrderByProvider[selectedProvider]?.order ?? null;
  const authOrderDisplay = toCommaList(authOrderValue);

  return {
    fallbackInput,
    setFallbackInput,
    authOrderInput,
    setAuthOrderInput,
    authMethodInput,
    setAuthMethodInput,
    providerOptions,
    authOrderValue,
    authOrderDisplay,
    parseCommaList,
  };
}
