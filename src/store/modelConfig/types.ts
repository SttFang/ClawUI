import type {
  ModelCatalogEntry,
  ModelsAuthOrderResult,
  ModelsStatus,
  ModelsStatusProbeOptions,
} from "@clawui/types/models";

export interface ModelConfigState {
  status: ModelsStatus | null;
  catalog: ModelCatalogEntry[];
  fallbacks: string[];
  authOrderByProvider: Record<string, ModelsAuthOrderResult | null>;
  selectedProvider: string;
  isStatusLoading: boolean;
  isCatalogLoading: boolean;
  isMutating: boolean;
  isAuthOrderLoading: boolean;
  error: string | null;
  success: string | null;
  lastProbeAt: number | null;
}

export interface ModelConfigPublicActions {
  loadStatus: (options?: ModelsStatusProbeOptions) => Promise<void>;
  loadCatalog: () => Promise<void>;
  loadFallbacks: () => Promise<void>;
  loadAll: () => Promise<void>;
  setSelectedProvider: (provider: string) => void;
  setDefaultModel: (model: string) => Promise<void>;
  addFallback: (model: string) => Promise<void>;
  removeFallback: (model: string) => Promise<void>;
  clearFallbacks: () => Promise<void>;
  loadAuthOrder: (provider?: string) => Promise<void>;
  saveAuthOrder: (profileIds: string[], provider?: string) => Promise<void>;
  clearAuthOrder: (provider?: string) => Promise<void>;
  runAuthLogin: (input?: {
    provider?: string;
    method?: string;
    setDefault?: boolean;
  }) => Promise<void>;
  clearMessages: () => void;
}

export interface ModelConfigInternalActions {
  internal_setError: (message: string | null) => void;
  internal_setSuccess: (message: string | null) => void;
}

export type ModelConfigStore = ModelConfigState &
  ModelConfigPublicActions &
  ModelConfigInternalActions;
