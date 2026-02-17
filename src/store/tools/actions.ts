import { ipc } from "@/lib/ipc";
import { toolsLog } from "@/lib/logger";
import { useConfigDraftStore } from "@/store/configDraft";
import type {
  ExecAskMode,
  ExecHostMode,
  ExecSecurityMode,
  ToolAccessMode,
  ToolsInternalActions,
  ToolsPublicActions,
  ToolsStore,
} from "./types";
import {
  applyEnabledToTools,
  asRecord,
  buildToolsPersistPatch,
  deriveExecAskMode,
  deriveExecHostMode,
  deriveExecSecurityMode,
  deriveSandboxEnabled,
  deriveToolAccessMode,
  normalizeExecHost,
  toStringArray,
} from "./helpers";

type ExecApprovalsSnapshot = {
  hash?: string;
  file: {
    version: 1;
    defaults?: { security?: string; ask?: string; askFallback?: string; autoAllowSkills?: boolean };
    agents?: Record<string, unknown>;
    socket?: { path?: string; token?: string };
  };
};

/**
 * Sync `defaults.ask` and `defaults.security` in exec-approvals.json
 * so the Gateway's runtime approval behaviour matches the UI setting.
 */
async function syncExecApprovals(ask: ExecAskMode, security: ExecSecurityMode): Promise<void> {
  try {
    const snapshot = (await ipc.chat.request("exec.approvals.get", {})) as ExecApprovalsSnapshot;
    const file = snapshot.file;
    const defaults = file.defaults ?? {};
    if (defaults.ask === ask && defaults.security === security) return;
    await ipc.chat.request("exec.approvals.set", {
      baseHash: snapshot.hash,
      file: { ...file, defaults: { ...defaults, ask, security } },
    });
  } catch (error) {
    toolsLog.warn("[tools.syncExecApprovals] failed to sync exec-approvals", error);
  }
}

type SetToolsState = (
  partial: Partial<ToolsStore> | ((state: ToolsStore) => Partial<ToolsStore> | ToolsStore),
  replace?: false,
  action?: string,
) => void;

type GetToolsState = () => ToolsStore;

async function withPersist(
  set: SetToolsState,
  get: GetToolsState,
  errorMessage: string,
  callback: () => Promise<void>,
): Promise<void> {
  const prev = get().config;
  try {
    await callback();
    await get().internal_persistConfig();
    set({ error: null }, false, "tools/persistOk");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toolsLog.error(errorMessage, error);
    set({ config: prev, error: message }, false, "tools/persistFail");
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

        let execAsk = deriveExecAskMode(toolsRaw);
        const sandboxEnabled = deriveSandboxEnabled(root);
        const execHost = normalizeExecHost(deriveExecHostMode(toolsRaw), sandboxEnabled);
        let execSecurity = deriveExecSecurityMode(toolsRaw, execHost);

        // exec-approvals.json is the source of truth for runtime behaviour;
        // prefer its values over openclaw.json so the UI reflects reality.
        try {
          const ea = (await ipc.chat.request("exec.approvals.get", {})) as ExecApprovalsSnapshot;
          const d = ea.file.defaults;
          if (d?.ask === "off" || d?.ask === "on-miss" || d?.ask === "always") execAsk = d.ask;
          if (d?.security === "deny" || d?.security === "allowlist" || d?.security === "full")
            execSecurity = d.security;
        } catch {
          // Gateway may be disconnected during startup — fall back to config values.
        }

        const config = {
          accessMode: deriveToolAccessMode({
            tools: toolsRaw,
            execAsk,
            execSecurity,
          }),
          allowList: toStringArray(toolsRaw.allow),
          denyList: toStringArray(toolsRaw.deny),
          sandboxEnabled,
          execHost,
          execAsk,
          execSecurity,
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
      await withPersist(set, get, "Failed to save access mode:", async () => {
        const config = get().config;
        const nextAsk: ExecAskMode =
          mode === "ask" ? "always" : mode === "deny" ? "off" : "on-miss";
        const nextHost = normalizeExecHost(config.execHost, config.sandboxEnabled);
        const nextSecurity: ExecSecurityMode =
          mode === "deny"
            ? "deny"
            : mode === "ask"
              ? "allowlist"
              : nextHost === "sandbox"
                ? "deny"
                : "allowlist";
        const nextDenyList =
          mode === "deny"
            ? config.denyList.includes("exec")
              ? config.denyList
              : [...config.denyList, "exec"]
            : config.denyList.filter((id) => id !== "exec");
        set(
          {
            config: {
              ...config,
              accessMode: mode,
              execHost: nextHost,
              execAsk: nextAsk,
              execSecurity: nextSecurity,
              denyList: nextDenyList,
            },
          },
          false,
          "tools/setAccessMode",
        );
        await syncExecApprovals(nextAsk, nextSecurity);
      });
    },

    setExecHost: async (host: ExecHostMode) => {
      await withPersist(set, get, "Failed to save exec host:", async () => {
        const config = get().config;
        set({ config: { ...config, execHost: host } }, false, "tools/setExecHost");
      });
    },

    setExecAsk: async (ask: ExecAskMode) => {
      await withPersist(set, get, "Failed to save exec ask mode:", async () => {
        const config = get().config;
        const accessMode: ToolAccessMode =
          ask === "always"
            ? "ask"
            : ask === "off" && config.execSecurity === "deny"
              ? "deny"
              : "auto";
        set({ config: { ...config, execAsk: ask, accessMode } }, false, "tools/setExecAsk");
        await syncExecApprovals(ask, config.execSecurity);
      });
    },

    setExecSecurity: async (security: ExecSecurityMode) => {
      await withPersist(set, get, "Failed to save exec security mode:", async () => {
        const config = get().config;
        const accessMode: ToolAccessMode =
          config.execAsk === "always"
            ? "ask"
            : config.execAsk === "off" && security === "deny"
              ? "deny"
              : "auto";
        set(
          { config: { ...config, execSecurity: security, accessMode } },
          false,
          "tools/setExecSecurity",
        );
        await syncExecApprovals(config.execAsk, security);
      });
    },

    setPolicyLists: async (lists: { allowList: string[]; denyList: string[] }) => {
      await withPersist(set, get, "Failed to save tool policy lists:", async () => {
        const config = get().config;
        set(
          {
            config: {
              ...config,
              allowList: [...lists.allowList],
              denyList: [...lists.denyList],
            },
          },
          false,
          "tools/setPolicyLists",
        );
      });
    },

    enableTool: async (toolId: string) => {
      await withPersist(set, get, "Failed to enable tool:", async () => {
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
      await withPersist(set, get, "Failed to disable tool:", async () => {
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
      await withPersist(set, get, "Failed to toggle sandbox:", async () => {
        const config = get().config;
        const nextHost = normalizeExecHost(config.execHost, enabled);
        set(
          { config: { ...config, sandboxEnabled: enabled, execHost: nextHost } },
          false,
          "tools/toggleSandbox",
        );
      });
    },

    addToAllowList: async (toolId: string) => {
      const { config } = get();
      if (config.allowList.includes(toolId)) return;

      await withPersist(set, get, "Failed to add to allow list:", async () => {
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

      await withPersist(set, get, "Failed to add to deny list:", async () => {
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
      await withPersist(set, get, "Failed to remove from allow list:", async () => {
        const config = get().config;
        const newAllowList = config.allowList.filter((id) => id !== toolId);
        set({ config: { ...config, allowList: newAllowList } }, false, "tools/removeFromAllowList");
      });
    },

    removeFromDenyList: async (toolId: string) => {
      await withPersist(set, get, "Failed to remove from deny list:", async () => {
        const config = get().config;
        const newDenyList = config.denyList.filter((id) => id !== toolId);
        set({ config: { ...config, denyList: newDenyList } }, false, "tools/removeFromDenyList");
      });
    },
  };
}
