import { useEffect } from "react";
import {
  selectModelConfigCatalog,
  selectModelConfigError,
  selectModelConfigFallbacks,
  selectModelConfigLastProbeAt,
  selectModelConfigLoading,
  selectModelConfigSelectedProvider,
  selectModelConfigStatus,
  selectModelConfigSuccess,
  useModelConfigStore,
} from "@/store/modelConfig";

export function useModelConfig() {
  const status = useModelConfigStore(selectModelConfigStatus);
  const catalog = useModelConfigStore(selectModelConfigCatalog);
  const fallbacks = useModelConfigStore(selectModelConfigFallbacks);
  const selectedProvider = useModelConfigStore(selectModelConfigSelectedProvider);
  const error = useModelConfigStore(selectModelConfigError);
  const success = useModelConfigStore(selectModelConfigSuccess);
  const isLoading = useModelConfigStore(selectModelConfigLoading);
  const lastProbeAt = useModelConfigStore(selectModelConfigLastProbeAt);

  const loadAll = useModelConfigStore((s) => s.loadAll);
  const clearMessages = useModelConfigStore((s) => s.clearMessages);
  const setDefaultModel = useModelConfigStore((s) => s.setDefaultModel);
  const addFallback = useModelConfigStore((s) => s.addFallback);
  const removeFallback = useModelConfigStore((s) => s.removeFallback);
  const clearFallbacks = useModelConfigStore((s) => s.clearFallbacks);
  const loadStatus = useModelConfigStore((s) => s.loadStatus);
  const setSelectedProvider = useModelConfigStore((s) => s.setSelectedProvider);
  const loadAuthOrder = useModelConfigStore((s) => s.loadAuthOrder);
  const saveAuthOrder = useModelConfigStore((s) => s.saveAuthOrder);
  const clearAuthOrder = useModelConfigStore((s) => s.clearAuthOrder);
  const runAuthLogin = useModelConfigStore((s) => s.runAuthLogin);
  const authOrderByProvider = useModelConfigStore((s) => s.authOrderByProvider);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const defaultModel = status?.defaultModel ?? "";

  return {
    status,
    catalog,
    fallbacks,
    selectedProvider,
    error,
    success,
    isLoading,
    lastProbeAt,
    defaultModel,
    authOrderByProvider,
    clearMessages,
    setDefaultModel,
    addFallback,
    removeFallback,
    clearFallbacks,
    loadStatus,
    setSelectedProvider,
    loadAuthOrder,
    saveAuthOrder,
    clearAuthOrder,
    runAuthLogin,
  };
}
