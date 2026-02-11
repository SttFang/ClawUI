import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { UIStore } from "./types";
import { createUIActions } from "./actions";
import { initialState } from "./initialState";
import { applyMotionPreference, applyTheme, subscribeMediaChange } from "./internalActions";

let listenersInitialized = false;

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      ...createUIActions(set, get),
    }),
    { name: "UIStore" },
  ),
);

export function initThemeListeners() {
  const { theme, motionPreference } = useUIStore.getState();
  applyTheme(theme);
  applyMotionPreference(motionPreference);

  if (listenersInitialized || typeof window === "undefined") return;
  listenersInitialized = true;

  subscribeMediaChange(window.matchMedia("(prefers-color-scheme: dark)"), () => {
    if (useUIStore.getState().theme === "system") {
      applyTheme("system");
    }
  });

  subscribeMediaChange(window.matchMedia("(prefers-reduced-motion: reduce)"), () => {
    if (useUIStore.getState().motionPreference === "system") {
      applyMotionPreference("system");
    }
  });
}

export function initTheme() {
  initThemeListeners();
}
