import { ConfigCoreManager } from "@clawui/config-core";
import { useConfigDraftStore } from "./index";

export const configCoreManager = new ConfigCoreManager(useConfigDraftStore, {
  conflictRetryCount: 1,
});
