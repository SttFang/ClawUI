import { createWeakCachedSelector } from "@/store/utils/createWeakCachedSelector";
import type { ToolAccessMode, ToolsConfig, ToolsStore } from "./types";

export const selectTools = (state: ToolsStore) => state.tools;
export const selectToolsConfig = (state: ToolsStore): ToolsConfig => state.config;
export const selectAccessMode = (state: ToolsStore): ToolAccessMode => state.config.accessMode;
export const selectEnabledTools = createWeakCachedSelector((state: ToolsStore) =>
  state.tools.filter((tool) => tool.enabled),
);
export const selectToolById = (id: string) => (state: ToolsStore) =>
  state.tools.find((tool) => tool.id === id);
export const selectIsLoading = (state: ToolsStore) => state.isLoading;
export const selectError = (state: ToolsStore) => state.error;

export const toolsSelectors = {
  selectTools,
  selectToolsConfig,
  selectAccessMode,
  selectEnabledTools,
  selectToolById,
  selectIsLoading,
  selectError,
};
