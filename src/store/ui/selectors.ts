import type { UIStore } from "./types";

export const selectTheme = (state: UIStore) => state.theme;
export const selectLocale = (state: UIStore) => state.locale;
export const selectSidebarCollapsed = (state: UIStore) => state.sidebarCollapsed;
export const selectMotionPreference = (state: UIStore) => state.motionPreference;

export const uiSelectors = {
  selectTheme,
  selectLocale,
  selectSidebarCollapsed,
  selectMotionPreference,
};
