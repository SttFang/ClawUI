import type { ToolsState } from "./types";
import { defaultTools } from "./defaultTools";

export const initialState: ToolsState = {
  tools: defaultTools,
  config: {
    accessMode: "auto",
    allowList: [],
    denyList: [],
    sandboxEnabled: true,
  },
  isLoading: false,
  error: null,
};
