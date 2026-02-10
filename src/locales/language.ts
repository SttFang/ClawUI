export const DEFAULT_LANG = "zh-CN" as const;
export const LANG_STORAGE_KEY = "clawui-locale" as const;
export const SUPPORTED_LANGS = ["zh-CN", "en-US"] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export type StoredLocale = SupportedLang | "system";

export function normalizeLanguage(language?: string): SupportedLang {
  if (!language) return DEFAULT_LANG;

  const value = language.toLowerCase();
  if (value.startsWith("zh")) return "zh-CN";
  if (value.startsWith("en")) return "en-US";

  return DEFAULT_LANG;
}

export function resolveStoredLocale(value: string | null): StoredLocale | undefined {
  if (!value) return undefined;
  if (value === "system") return "system";
  return normalizeLanguage(value);
}

export function resolveEffectiveLanguage(
  stored: StoredLocale | undefined,
  navigatorLanguage?: string,
): SupportedLang {
  const mode: StoredLocale = stored ?? "system";
  if (mode === "system") return normalizeLanguage(navigatorLanguage);
  return mode;
}
