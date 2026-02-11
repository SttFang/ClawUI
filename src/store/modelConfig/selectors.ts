import type { ModelConfigStore } from "./types";

export const selectModelConfigStatus = (state: ModelConfigStore) => state.status;
export const selectModelConfigCatalog = (state: ModelConfigStore) => state.catalog;
export const selectModelConfigFallbacks = (state: ModelConfigStore) => state.fallbacks;
export const selectModelConfigSelectedProvider = (state: ModelConfigStore) =>
  state.selectedProvider;
export const selectModelConfigLoading = (state: ModelConfigStore) =>
  state.isStatusLoading || state.isCatalogLoading || state.isMutating || state.isAuthOrderLoading;
export const selectModelConfigError = (state: ModelConfigStore) => state.error;
export const selectModelConfigSuccess = (state: ModelConfigStore) => state.success;
export const selectModelConfigLastProbeAt = (state: ModelConfigStore) => state.lastProbeAt;

export const modelConfigSelectors = {
  selectModelConfigStatus,
  selectModelConfigCatalog,
  selectModelConfigFallbacks,
  selectModelConfigSelectedProvider,
  selectModelConfigLoading,
  selectModelConfigError,
  selectModelConfigSuccess,
  selectModelConfigLastProbeAt,
};
