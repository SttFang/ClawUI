import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MotionPreference, Theme } from "../types";
import {
  initThemeListeners,
  selectLocale,
  selectMotionPreference,
  selectSidebarCollapsed,
  selectTheme,
  useUIStore,
} from "../index";

const mocks = vi.hoisted(() => ({
  patchState: vi.fn<(patch: unknown) => Promise<void>>(),
  changeLanguage: vi.fn<(lang: string) => Promise<void>>(),
  uiLogError: vi.fn<(message: string, ...args: unknown[]) => void>(),
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    state: {
      patch: mocks.patchState,
    },
  },
}));

vi.mock("@/locales/i18n", () => ({
  i18n: {
    language: "zh-CN",
    changeLanguage: mocks.changeLanguage,
  },
}));

vi.mock("@/lib/logger", () => ({
  uiLog: {
    error: mocks.uiLogError,
  },
}));

const mediaMatches = new Map<string, boolean>();
const mediaListeners = new Map<string, Array<() => void>>();

function installMatchMediaMock() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string): MediaQueryList => {
      const listeners = mediaListeners.get(query) ?? [];
      mediaListeners.set(query, listeners);

      return {
        matches: mediaMatches.get(query) ?? false,
        media: query,
        onchange: null,
        addListener: vi.fn((listener: () => void) => {
          listeners.push(listener);
        }),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_eventName: string, listener: () => void) => {
          listeners.push(listener);
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList;
    }),
  });
}

function emitMediaChange(query: string) {
  for (const listener of mediaListeners.get(query) ?? []) {
    listener();
  }
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("UIStore", () => {
  beforeEach(() => {
    mediaMatches.clear();
    mediaListeners.clear();
    installMatchMediaMock();

    document.documentElement.className = "";

    mocks.patchState.mockResolvedValue(undefined);
    mocks.changeLanguage.mockResolvedValue(undefined);
    vi.clearAllMocks();

    useUIStore.setState({
      theme: "system",
      locale: "system",
      sidebarCollapsed: false,
      motionPreference: "system",
    });
  });

  describe("setTheme", () => {
    describe("happy path", () => {
      it("should persist light theme and clear dark class", async () => {
        useUIStore.getState().setTheme("light");

        expect(useUIStore.getState().theme).toBe("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
        expect(mocks.patchState).toHaveBeenCalledWith({ ui: { theme: "light" } });
        await flushMicrotasks();
      });

      it("should apply system dark theme when OS prefers dark", () => {
        mediaMatches.set("(prefers-color-scheme: dark)", true);

        useUIStore.getState().setTheme("system");

        expect(useUIStore.getState().theme).toBe("system");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    describe("error handling", () => {
      it("should log persistence errors without reverting UI state", async () => {
        mocks.patchState.mockRejectedValueOnce(new Error("patch failed"));

        useUIStore.getState().setTheme("dark");
        await flushMicrotasks();

        expect(useUIStore.getState().theme).toBe("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        expect(mocks.uiLogError).toHaveBeenCalled();
      });
    });
  });

  describe("setLocale", () => {
    describe("happy path", () => {
      it("should update locale and change i18n language", async () => {
        useUIStore.getState().setLocale("en-US");

        expect(useUIStore.getState().locale).toBe("en-US");
        expect(mocks.changeLanguage).toHaveBeenCalledWith("en-US");
        expect(mocks.patchState).toHaveBeenCalledWith({ ui: { locale: "en-US" } });
        await flushMicrotasks();
      });
    });
  });

  describe("sidebar actions", () => {
    it("should toggle sidebar state and persist patch", async () => {
      useUIStore.getState().toggleSidebar();

      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
      expect(mocks.patchState).toHaveBeenCalledWith({ ui: { sidebarCollapsed: true } });
      await flushMicrotasks();
    });

    it("should set sidebar collapsed state directly", async () => {
      useUIStore.getState().setSidebarCollapsed(true);

      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
      expect(mocks.patchState).toHaveBeenCalledWith({ ui: { sidebarCollapsed: true } });
      await flushMicrotasks();
    });
  });

  describe("setMotionPreference", () => {
    describe("happy path", () => {
      it("should enforce reduced motion class", async () => {
        useUIStore.getState().setMotionPreference("reduce");

        expect(useUIStore.getState().motionPreference).toBe("reduce");
        expect(document.documentElement.classList.contains("reduce-motion")).toBe(true);
        expect(document.documentElement.classList.contains("allow-motion")).toBe(false);
        expect(mocks.patchState).toHaveBeenCalledWith({
          ui: { motionPreference: "reduce" },
        });
        await flushMicrotasks();
      });

      it("should enforce explicit motion allowed class", async () => {
        useUIStore.getState().setMotionPreference("no-preference");

        expect(useUIStore.getState().motionPreference).toBe("no-preference");
        expect(document.documentElement.classList.contains("allow-motion")).toBe(true);
        expect(document.documentElement.classList.contains("reduce-motion")).toBe(false);
        await flushMicrotasks();
      });
    });
  });

  describe("hydrate", () => {
    it("should hydrate state without persistence side effects", () => {
      const nextTheme: Theme = "dark";
      const nextMotion: MotionPreference = "reduce";

      useUIStore.getState().hydrate({
        theme: nextTheme,
        locale: "en-US",
        sidebarCollapsed: true,
        motionPreference: nextMotion,
      });

      const state = useUIStore.getState();
      expect(state.theme).toBe("dark");
      expect(state.locale).toBe("en-US");
      expect(state.sidebarCollapsed).toBe(true);
      expect(state.motionPreference).toBe("reduce");
      expect(mocks.patchState).not.toHaveBeenCalled();
    });
  });

  describe("selectors", () => {
    it("should read all selector values from state", () => {
      useUIStore.setState({
        theme: "dark",
        locale: "en-US",
        sidebarCollapsed: true,
        motionPreference: "reduce",
      });

      const state = useUIStore.getState();
      expect(selectTheme(state)).toBe("dark");
      expect(selectLocale(state)).toBe("en-US");
      expect(selectSidebarCollapsed(state)).toBe(true);
      expect(selectMotionPreference(state)).toBe("reduce");
    });
  });

  describe("initThemeListeners", () => {
    it("should react to system preference changes in system mode", () => {
      mediaMatches.set("(prefers-color-scheme: dark)", false);
      mediaMatches.set("(prefers-reduced-motion: reduce)", false);

      initThemeListeners();
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.classList.contains("reduce-motion")).toBe(false);

      mediaMatches.set("(prefers-color-scheme: dark)", true);
      mediaMatches.set("(prefers-reduced-motion: reduce)", true);

      emitMediaChange("(prefers-color-scheme: dark)");
      emitMediaChange("(prefers-reduced-motion: reduce)");

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("reduce-motion")).toBe(true);
    });
  });
});
