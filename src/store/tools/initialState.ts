import type { ToolsState } from "./types";
import { defaultTools } from "./defaultTools";

export const initialState: ToolsState = {
  tools: defaultTools,
  config: {
    accessMode: "auto",
    allowList: [],
    denyList: [],
    sandboxEnabled: true,
    execHost: "sandbox",
    execAsk: "on-miss",
    execSecurity: "deny",
  },
  isLoading: false,
  error: null,
};
