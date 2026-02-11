import type { UIInternalActions, UIPublicActions, UIState, UIStore } from "./types";
import { applyLocale, applyMotionPreference, applyTheme, persistUiPatch } from "./internalActions";

type SetUIState = (
  partial: Partial<UIStore> | ((state: UIStore) => Partial<UIStore> | UIStore),
  replace?: false,
  action?: string,
) => void;

type GetUIState = () => UIStore;

export function createUIActions(
  set: SetUIState,
  get: GetUIState,
): UIPublicActions & UIInternalActions {
  return {
    internal_dispatchUI: (patch, action) => {
      set(patch, false, action);
    },

    internal_applyTheme: (theme) => {
      applyTheme(theme);
    },

    internal_applyLocale: (locale) => {
      applyLocale(locale);
    },

    internal_applyMotionPreference: (preference) => {
      applyMotionPreference(preference);
    },

    internal_persistUiPatch: async (patch) => {
      await persistUiPatch(patch);
    },

    hydrate: (state) => {
      const {
        internal_dispatchUI,
        internal_applyTheme,
        internal_applyLocale,
        internal_applyMotionPreference,
      } = get();

      if (state.theme) {
        internal_dispatchUI({ theme: state.theme }, "ui/hydrate/theme");
        internal_applyTheme(state.theme);
      }

      if (state.locale) {
        internal_dispatchUI({ locale: state.locale }, "ui/hydrate/locale");
        internal_applyLocale(state.locale);
      }

      if (typeof state.sidebarCollapsed === "boolean") {
        internal_dispatchUI(
          { sidebarCollapsed: state.sidebarCollapsed },
          "ui/hydrate/sidebarCollapsed",
        );
      }

      if (state.motionPreference) {
        internal_dispatchUI(
          { motionPreference: state.motionPreference },
          "ui/hydrate/motionPreference",
        );
        internal_applyMotionPreference(state.motionPreference);
      }
    },

    setTheme: (theme) => {
      const { internal_dispatchUI, internal_applyTheme, internal_persistUiPatch } = get();
      internal_dispatchUI({ theme }, "ui/setTheme");
      internal_applyTheme(theme);
      void internal_persistUiPatch({ theme });
    },

    setLocale: (locale) => {
      const { internal_dispatchUI, internal_applyLocale, internal_persistUiPatch } = get();
      internal_dispatchUI({ locale }, "ui/setLocale");
      internal_applyLocale(locale);
      void internal_persistUiPatch({ locale });
    },

    toggleSidebar: () => {
      const next = !get().sidebarCollapsed;
      const { internal_dispatchUI, internal_persistUiPatch } = get();
      internal_dispatchUI({ sidebarCollapsed: next }, "ui/toggleSidebar");
      void internal_persistUiPatch({ sidebarCollapsed: next });
    },

    setSidebarCollapsed: (collapsed) => {
      const { internal_dispatchUI, internal_persistUiPatch } = get();
      internal_dispatchUI({ sidebarCollapsed: collapsed }, "ui/setSidebarCollapsed");
      void internal_persistUiPatch({ sidebarCollapsed: collapsed });
    },

    setMotionPreference: (preference) => {
      const { internal_dispatchUI, internal_applyMotionPreference, internal_persistUiPatch } =
        get();
      internal_dispatchUI({ motionPreference: preference }, "ui/setMotionPreference");
      internal_applyMotionPreference(preference);
      void internal_persistUiPatch({ motionPreference: preference });
    },
  };
}

export type UIHydrateState = Partial<UIState>;
