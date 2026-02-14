export const SETTINGS_TABS = ["general", "ai", "messaging", "capabilities"] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const CAPABILITIES_SECTIONS = ["tools", "skills", "plugins"] as const;

export type CapabilitiesSection = (typeof CAPABILITIES_SECTIONS)[number];

export function isSettingsTab(value: string | null): value is SettingsTab {
  return Boolean(value) && SETTINGS_TABS.includes(value as SettingsTab);
}

export function isCapabilitiesSection(value: string | null): value is CapabilitiesSection {
  return Boolean(value) && CAPABILITIES_SECTIONS.includes(value as CapabilitiesSection);
}

export function resolveTabFromSection(section: string | null): SettingsTab {
  if (!section) return "general";
  if (section === "channels") return "messaging";
  if (isCapabilitiesSection(section)) return "capabilities";
  return "general";
}

const SETTINGS_ALIAS_TO_TAB = {
  channels: { tab: "messaging" },
  tools: { tab: "capabilities", section: "tools" },
  mcp: { tab: "capabilities", section: "skills" },
  skills: { tab: "capabilities", section: "skills" },
  plugins: { tab: "capabilities", section: "plugins" },
} as const;

type SettingsAliasPath = keyof typeof SETTINGS_ALIAS_TO_TAB;

export type SettingsAliasRoute = {
  path: SettingsAliasPath;
  to: string;
};

export const SETTINGS_ALIAS_ROUTES: SettingsAliasRoute[] = Object.entries(
  SETTINGS_ALIAS_TO_TAB,
).map(([path, target]) => ({
  path: path as SettingsAliasPath,
  to: `/settings?tab=${target.tab}${"section" in target ? `&section=${target.section}` : ""}`,
}));
