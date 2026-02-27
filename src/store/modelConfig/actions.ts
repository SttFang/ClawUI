import type { StateCreator } from "zustand";
import { ipc } from "@/lib/ipc";
import type {
  ModelConfigInternalActions,
  ModelConfigPublicActions,
  ModelConfigStore,
} from "./types";

function resolveProvider(store: ModelConfigStore, explicit?: string): string {
  const value = explicit?.trim() || store.selectedProvider.trim();
  if (value) return value;
  const fallback = store.status?.auth.providers?.[0]?.provider ?? "";
  return fallback.trim();
}

function normalizeProfileIds(input: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of input) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

export const createModelConfigActions: StateCreator<
  ModelConfigStore,
  [["zustand/devtools", never]],
  [],
  ModelConfigPublicActions & ModelConfigInternalActions
> = (set, get) => ({
  internal_setError: (message) => {
    set({ error: message, success: null }, false, "modelConfig/internal_setError");
  },

  internal_setSuccess: (message) => {
    set({ success: message, error: null }, false, "modelConfig/internal_setSuccess");
  },

  clearMessages: () => {
    set({ error: null, success: null }, false, "modelConfig/clearMessages");
  },

  setSelectedProvider: (provider) => {
    set({ selectedProvider: provider.trim() }, false, "modelConfig/setSelectedProvider");
  },

  loadStatus: async (options) => {
    set({ isStatusLoading: true }, false, "modelConfig/loadStatus");
    try {
      const status = await ipc.models.status(options);
      set(
        (state) => ({
          status,
          isStatusLoading: false,
          selectedProvider:
            state.selectedProvider.trim() || status?.auth.providers?.[0]?.provider?.trim() || "",
          lastProbeAt: options?.probe ? Date.now() : state.lastProbeAt,
        }),
        false,
        "modelConfig/loadStatus/success",
      );
    } catch (error) {
      get().internal_setError(
        error instanceof Error ? error.message : "Failed to load model status",
      );
      set({ isStatusLoading: false }, false, "modelConfig/loadStatus/error");
    }
  },

  loadCatalog: async () => {
    set({ isCatalogLoading: true }, false, "modelConfig/loadCatalog");
    try {
      const result = await ipc.models.list();
      const models = result.models ?? [];
      set({ catalog: models, isCatalogLoading: false }, false, "modelConfig/loadCatalog/success");
    } catch (error) {
      get().internal_setError(
        error instanceof Error ? error.message : "Failed to load model catalog",
      );
      set({ isCatalogLoading: false }, false, "modelConfig/loadCatalog/error");
    }
  },

  loadFallbacks: async () => {
    try {
      const result = await ipc.models.listFallbacks();
      set({ fallbacks: result.fallbacks ?? [] }, false, "modelConfig/loadFallbacks/success");
    } catch (error) {
      get().internal_setError(
        error instanceof Error ? error.message : "Failed to load fallback models",
      );
    }
  },

  loadAll: async () => {
    await Promise.all([get().loadStatus(), get().loadCatalog(), get().loadFallbacks()]);
  },

  setDefaultModel: async (model) => {
    const value = model.trim();
    if (!value) return;
    set({ isMutating: true }, false, "modelConfig/setDefaultModel");
    try {
      await ipc.models.setDefault(value);
      await get().loadStatus();
      get().internal_setSuccess("Default model updated");
    } catch (error) {
      get().internal_setError(
        error instanceof Error ? error.message : "Failed to set default model",
      );
    } finally {
      set({ isMutating: false }, false, "modelConfig/setDefaultModel/finally");
    }
  },

  addFallback: async (model) => {
    const value = model.trim();
    if (!value) return;
    set({ isMutating: true }, false, "modelConfig/addFallback");
    try {
      await ipc.models.addFallback(value);
      await Promise.all([get().loadFallbacks(), get().loadStatus()]);
      get().internal_setSuccess("Fallback model added");
    } catch (error) {
      get().internal_setError(
        error instanceof Error ? error.message : "Failed to add fallback model",
      );
    } finally {
      set({ isMutating: false }, false, "modelConfig/addFallback/finally");
    }
  },

  removeFallback: async (model) => {
    const value = model.trim();
    if (!value) return;
    set({ isMutating: true }, false, "modelConfig/removeFallback");
    try {
      await ipc.models.removeFallback(value);
      await Promise.all([get().loadFallbacks(), get().loadStatus()]);
      get().internal_setSuccess("Fallback model removed");
    } catch (error) {
      get().internal_setError(
        error instanceof Error ? error.message : "Failed to remove fallback model",
      );
    } finally {
      set({ isMutating: false }, false, "modelConfig/removeFallback/finally");
    }
  },

  clearFallbacks: async () => {
    set({ isMutating: true }, false, "modelConfig/clearFallbacks");
    try {
      await ipc.models.clearFallbacks();
      await Promise.all([get().loadFallbacks(), get().loadStatus()]);
      get().internal_setSuccess("Fallback models cleared");
    } catch (error) {
      get().internal_setError(
        error instanceof Error ? error.message : "Failed to clear fallback models",
      );
    } finally {
      set({ isMutating: false }, false, "modelConfig/clearFallbacks/finally");
    }
  },

  loadAuthOrder: async (provider) => {
    const targetProvider = resolveProvider(get(), provider);
    if (!targetProvider) return;
    set({ isAuthOrderLoading: true }, false, "modelConfig/loadAuthOrder");
    try {
      const result = await ipc.models.getAuthOrder({ provider: targetProvider });
      set(
        (state) => ({
          authOrderByProvider: {
            ...state.authOrderByProvider,
            [targetProvider]: result,
          },
          selectedProvider: targetProvider,
          isAuthOrderLoading: false,
        }),
        false,
        "modelConfig/loadAuthOrder/success",
      );
    } catch (error) {
      get().internal_setError(error instanceof Error ? error.message : "Failed to load auth order");
      set({ isAuthOrderLoading: false }, false, "modelConfig/loadAuthOrder/error");
    }
  },

  saveAuthOrder: async (profileIds, provider) => {
    const targetProvider = resolveProvider(get(), provider);
    if (!targetProvider) return;
    const normalized = normalizeProfileIds(profileIds);
    if (normalized.length === 0) {
      get().internal_setError("profileIds cannot be empty");
      return;
    }
    set({ isAuthOrderLoading: true }, false, "modelConfig/saveAuthOrder");
    try {
      const result = await ipc.models.setAuthOrder({
        provider: targetProvider,
        profileIds: normalized,
      });
      set(
        (state) => ({
          authOrderByProvider: {
            ...state.authOrderByProvider,
            [targetProvider]: result,
          },
          selectedProvider: targetProvider,
          isAuthOrderLoading: false,
        }),
        false,
        "modelConfig/saveAuthOrder/success",
      );
      get().internal_setSuccess("Auth order updated");
    } catch (error) {
      get().internal_setError(error instanceof Error ? error.message : "Failed to save auth order");
      set({ isAuthOrderLoading: false }, false, "modelConfig/saveAuthOrder/error");
    }
  },

  clearAuthOrder: async (provider) => {
    const targetProvider = resolveProvider(get(), provider);
    if (!targetProvider) return;
    set({ isAuthOrderLoading: true }, false, "modelConfig/clearAuthOrder");
    try {
      const result = await ipc.models.clearAuthOrder({ provider: targetProvider });
      set(
        (state) => ({
          authOrderByProvider: {
            ...state.authOrderByProvider,
            [targetProvider]: result,
          },
          selectedProvider: targetProvider,
          isAuthOrderLoading: false,
        }),
        false,
        "modelConfig/clearAuthOrder/success",
      );
      get().internal_setSuccess("Auth order cleared");
    } catch (error) {
      get().internal_setError(
        error instanceof Error ? error.message : "Failed to clear auth order",
      );
      set({ isAuthOrderLoading: false }, false, "modelConfig/clearAuthOrder/error");
    }
  },

  runAuthLogin: async (input) => {
    set({ isMutating: true }, false, "modelConfig/runAuthLogin");
    try {
      const targetProvider = input?.provider || resolveProvider(get());
      await ipc.models.authLogin({
        provider: targetProvider || undefined,
        method: input?.method,
        setDefault: Boolean(input?.setDefault),
      });
      await get().loadStatus();
      get().internal_setSuccess("Auth login completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run auth login";
      if (message.includes("interactive TTY")) {
        get().internal_setError(
          "当前环境不支持交互式 OAuth 登录，请在终端运行 `openclaw models auth login --provider <provider>` 完成授权。",
        );
      } else {
        get().internal_setError(message);
      }
    } finally {
      set({ isMutating: false }, false, "modelConfig/runAuthLogin/finally");
    }
  },
});
