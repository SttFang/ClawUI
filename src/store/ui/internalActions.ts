import { ipc } from "@/lib/ipc";
import { uiLog } from "@/lib/logger";
import { i18n } from "@/locales/i18n";
import { resolveEffectiveLanguage } from "@/locales/language";
import type { LocalePreference, MotionPreference, Theme, UIState } from "./types";

const REDUCE_MOTION_CLASS = "reduce-motion";
const ALLOW_MOTION_CLASS = "allow-motion";

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const getSystemTheme = (): "light" | "dark" => {
  if (!isBrowser()) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getSystemReduceMotion = (): boolean => {
  if (!isBrowser()) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export const applyTheme = (theme: Theme) => {
  if (!isBrowser()) return;
  const root = document.documentElement;
  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;

  if (effectiveTheme === "dark") {
    root.classList.add("dark");
    return;
  }

  root.classList.remove("dark");
};

export const applyLocale = (locale: LocalePreference) => {
  const effective =
    locale === "system" && typeof navigator !== "undefined"
      ? resolveEffectiveLanguage("system", navigator.language)
      : locale === "system"
        ? "zh-CN"
        : locale;

  void i18n.changeLanguage(effective);
};

export const applyMotionPreference = (preference: MotionPreference) => {
  if (!isBrowser()) return;
  const root = document.documentElement;

  if (preference === "reduce") {
    root.classList.add(REDUCE_MOTION_CLASS);
    root.classList.remove(ALLOW_MOTION_CLASS);
    return;
  }

  if (preference === "no-preference") {
    root.classList.remove(REDUCE_MOTION_CLASS);
    root.classList.add(ALLOW_MOTION_CLASS);
    return;
  }

  root.classList.toggle(REDUCE_MOTION_CLASS, getSystemReduceMotion());
  root.classList.remove(ALLOW_MOTION_CLASS);
};

export async function persistUiPatch(patch: Partial<UIState>): Promise<void> {
  try {
    await ipc.state.patch({ ui: patch });
  } catch (error) {
    uiLog.error("[ui.persist.patch.failed]", patch, error);
  }
}

export function subscribeMediaChange(media: MediaQueryList, callback: () => void): void {
  media.addEventListener("change", () => callback());
}
