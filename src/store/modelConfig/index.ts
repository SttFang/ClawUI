import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ModelConfigStore } from "./types";
import { createModelConfigActions } from "./actions";
import { initialModelConfigState } from "./initialState";
import {
  modelConfigSelectors,
  selectModelConfigCatalog,
  selectModelConfigError,
  selectModelConfigFallbacks,
  selectModelConfigLastProbeAt,
  selectModelConfigLoading,
  selectModelConfigSelectedProvider,
  selectModelConfigStatus,
  selectModelConfigSuccess,
} from "./selectors";

export const useModelConfigStore = create<ModelConfigStore>()(
  devtools(
    (...args) => ({
      ...initialModelConfigState,
      ...createModelConfigActions(...args),
    }),
    {
      name: "ModelConfigStore",
    },
  ),
);

export {
  modelConfigSelectors,
  selectModelConfigCatalog,
  selectModelConfigError,
  selectModelConfigFallbacks,
  selectModelConfigLastProbeAt,
  selectModelConfigLoading,
  selectModelConfigSelectedProvider,
  selectModelConfigStatus,
  selectModelConfigSuccess,
};
