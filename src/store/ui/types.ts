export type Theme = "light" | "dark" | "system";
export type LocalePreference = "system" | "zh-CN" | "en-US";
export type MotionPreference = "system" | "reduce" | "no-preference";

export interface UIState {
  theme: Theme;
  locale: LocalePreference;
  sidebarCollapsed: boolean;
  motionPreference: MotionPreference;
}

export interface UIPublicActions {
  setTheme: (theme: Theme) => void;
  setLocale: (locale: LocalePreference) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMotionPreference: (preference: MotionPreference) => void;
  hydrate: (state: Partial<UIState>) => void;
}

export interface UIInternalActions {
  internal_dispatchUI: (patch: Partial<UIState>, action: string) => void;
  internal_applyTheme: (theme: Theme) => void;
  internal_applyLocale: (locale: LocalePreference) => void;
  internal_applyMotionPreference: (preference: MotionPreference) => void;
  internal_persistUiPatch: (patch: Partial<UIState>) => Promise<void>;
}

export type UIStore = UIState & UIPublicActions & UIInternalActions;
