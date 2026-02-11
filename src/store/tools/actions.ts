import { ipc } from "@/lib/ipc";
import { toolsLog } from "@/lib/logger";
import { useConfigDraftStore } from "@/store/configDraft";
import type { ToolAccessMode, ToolsInternalActions, ToolsPublicActions, ToolsStore } from "./types";
import {
  applyEnabledToTools,
  asRecord,
  buildToolsPersistPatch,
  deriveSandboxEnabled,
  deriveToolAccessMode,
  toStringArray,
} from "./helpers";

type SetToolsState = (
  partial: Partial<ToolsStore> | ((state: ToolsStore) => Partial<ToolsStore> | ToolsStore),
  replace?: false,
  action?: string,
) => void;

type GetToolsState = () => ToolsStore;

async function withPersist(
  get: GetToolsState,
  errorMessage: string,
  callback: () => Promise<void>,
): Promise<void> {
  try {
    await callback();
    await get().internal_persistConfig();
  } catch (error) {
    toolsLog.error(errorMessage, error);
  }
}

export function createToolsActions(
  set: SetToolsState,
  get: GetToolsState,
): ToolsPublicActions & ToolsInternalActions {
  return {
    loadTools: async () => {
      set({ isLoading: true, error: null }, false, "tools/load");
      try {
        const snapshot = await ipc.config.getSnapshot();
        const root = asRecord(snapshot.config) ?? {};
        const toolsRaw = asRecord(root.tools);
        if (!toolsRaw) {
          set({ isLoading: false }, false, "tools/load/empty");
          return;
        }

        const config = {
          accessMode: deriveToolAccessMode(toolsRaw),
          allowList: toStringArray(toolsRaw.allow),
          denyList: toStringArray(toolsRaw.deny),
          sandboxEnabled: deriveSandboxEnabled(root),
        };
        const tools = applyEnabledToTools(get().tools, config);
        set({ config, tools, isLoading: false }, false, "tools/load/success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load tools config";
        set({ error: message, isLoading: false }, false, "tools/load/error");
      }
    },

    internal_persistConfig: async () => {
      await useConfigDraftStore.getState().applyPatch(buildToolsPersistPatch(get().config));
    },

    setAccessMode: async (mode: ToolAccessMode) => {
      await withPersist(get, "Failed to save access mode:", async () => {
        set({ config: { ...get().config, accessMode: mode } }, false, "tools/setAccessMode");
      });
    },

    enableTool: async (toolId: string) => {
      await withPersist(get, "Failed to enable tool:", async () => {
        const { tools, config } = get();
        const newTools = tools.map((tool) =>
          tool.id === toolId ? { ...tool, enabled: true } : tool,
        );
        const newDenyList = config.denyList.filter((id) => id !== toolId);
        const newAllowList = config.allowList.includes(toolId)
          ? config.allowList
          : [...config.allowList, toolId];

        set(
          {
            tools: newTools,
            config: { ...config, allowList: newAllowList, denyList: newDenyList },
          },
          false,
          "tools/enableTool",
        );
      });
    },

    disableTool: async (toolId: string) => {
      await withPersist(get, "Failed to disable tool:", async () => {
        const { tools, config } = get();
        const newTools = tools.map((tool) =>
          tool.id === toolId ? { ...tool, enabled: false } : tool,
        );
        const newAllowList = config.allowList.filter((id) => id !== toolId);
        const newDenyList = config.denyList.includes(toolId)
          ? config.denyList
          : [...config.denyList, toolId];

        set(
          {
            tools: newTools,
            config: { ...config, allowList: newAllowList, denyList: newDenyList },
          },
          false,
          "tools/disableTool",
        );
      });
    },

    toggleSandbox: async (enabled: boolean) => {
      await withPersist(get, "Failed to toggle sandbox:", async () => {
        set({ config: { ...get().config, sandboxEnabled: enabled } }, false, "tools/toggleSandbox");
      });
    },

    addToAllowList: async (toolId: string) => {
      const { config } = get();
      if (config.allowList.includes(toolId)) return;

      await withPersist(get, "Failed to add to allow list:", async () => {
        const nextConfig = get().config;
        const newAllowList = [...nextConfig.allowList, toolId];
        const newDenyList = nextConfig.denyList.filter((id) => id !== toolId);
        set(
          { config: { ...nextConfig, allowList: newAllowList, denyList: newDenyList } },
          false,
          "tools/addToAllowList",
        );
      });
    },

    addToDenyList: async (toolId: string) => {
      const { config } = get();
      if (config.denyList.includes(toolId)) return;

      await withPersist(get, "Failed to add to deny list:", async () => {
        const nextConfig = get().config;
        const newDenyList = [...nextConfig.denyList, toolId];
        const newAllowList = nextConfig.allowList.filter((id) => id !== toolId);
        set(
          { config: { ...nextConfig, allowList: newAllowList, denyList: newDenyList } },
          false,
          "tools/addToDenyList",
        );
      });
    },

    removeFromAllowList: async (toolId: string) => {
      await withPersist(get, "Failed to remove from allow list:", async () => {
        const config = get().config;
        const newAllowList = config.allowList.filter((id) => id !== toolId);
        set({ config: { ...config, allowList: newAllowList } }, false, "tools/removeFromAllowList");
      });
    },

    removeFromDenyList: async (toolId: string) => {
      await withPersist(get, "Failed to remove from deny list:", async () => {
        const config = get().config;
        const newDenyList = config.denyList.filter((id) => id !== toolId);
        set({ config: { ...config, denyList: newDenyList } }, false, "tools/removeFromDenyList");
      });
    },
  };
}
