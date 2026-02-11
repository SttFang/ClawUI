import type { ModelConfigState } from "./types";

export const initialModelConfigState: ModelConfigState = {
  status: null,
  catalog: [],
  fallbacks: [],
  authOrderByProvider: {},
  selectedProvider: "",
  isStatusLoading: false,
  isCatalogLoading: false,
  isMutating: false,
  isAuthOrderLoading: false,
  error: null,
  success: null,
  lastProbeAt: null,
};
