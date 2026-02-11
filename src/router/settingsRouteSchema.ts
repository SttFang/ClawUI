export const SETTINGS_TABS = [
  "general",
  "config",
  "api",
  "tokens",
  "gateway",
  "security",
  "subscription",
  "about",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const CONFIG_SECTIONS = ["channels", "tools", "skills", "plugins"] as const;

export type ConfigSection = (typeof CONFIG_SECTIONS)[number];

export function isSettingsTab(value: string | null): value is SettingsTab {
  return Boolean(value) && SETTINGS_TABS.includes(value as SettingsTab);
}

export function isConfigSection(value: string | null): value is ConfigSection {
  return Boolean(value) && CONFIG_SECTIONS.includes(value as ConfigSection);
}

export function resolveTabFromSection(section: string | null): SettingsTab {
  if (!section) return "general";
  if (isConfigSection(section)) return "config";
  return "general";
}

export function resolveConfigSection(section: string | null): ConfigSection {
  return isConfigSection(section) ? section : "channels";
}

const SETTINGS_ALIAS_TO_SECTION = {
  channels: "channels",
  tools: "tools",
  mcp: "skills",
  skills: "skills",
  plugins: "plugins",
} as const;

type SettingsAliasPath = keyof typeof SETTINGS_ALIAS_TO_SECTION;

export type SettingsAliasRoute = {
  path: SettingsAliasPath;
  to: string;
};

export const SETTINGS_ALIAS_ROUTES: SettingsAliasRoute[] = Object.entries(
  SETTINGS_ALIAS_TO_SECTION,
).map(([path, section]) => ({
  path: path as SettingsAliasPath,
  to: `/settings?tab=config&section=${section}`,
}));
