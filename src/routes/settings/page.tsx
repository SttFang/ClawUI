import { Tabs, TabsContent, TabsList, TabsTrigger } from "@clawui/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Subscription } from "@/features/Subscription";
import { useSecretsStore } from "@/store/secrets";
import { useSettingsStore } from "@/store/settings";
import { AboutTab } from "./AboutTab";
import { ApiTab } from "./ApiTab";
import { ConfigTab } from "./config/ConfigTab";
import { GatewayTab } from "./GatewayTab";
import { GeneralTab } from "./GeneralTab";
import { SecurityTab } from "./SecurityTab";
import { TokensTab } from "./TokensTab";

const SETTINGS_TABS = [
  "general",
  "config",
  "api",
  "tokens",
  "gateway",
  "security",
  "subscription",
  "about",
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
  return Boolean(value) && SETTINGS_TABS.includes(value as SettingsTab);
}

function resolveTabFromSection(section: string | null): SettingsTab {
  if (!section) return "general";
  if (
    section === "channels" ||
    section === "tools" ||
    section === "skills" ||
    section === "plugins"
  )
    return "config";
  return "general";
}

export default function SettingsPage() {
  const { t } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadPreferences = useSettingsStore((s) => s.loadPreferences);
  const loadModelsStatus = useSettingsStore((s) => s.loadModelsStatus);
  const loadSecrets = useSecretsStore((s) => s.load);

  useEffect(() => {
    loadSettings();
    loadPreferences();
    loadModelsStatus();
    loadSecrets();
  }, [loadSettings, loadPreferences, loadModelsStatus, loadSecrets]);

  const tabParam = searchParams.get("tab");
  const sectionParam = searchParams.get("section");
  const activeTab: SettingsTab = isSettingsTab(tabParam)
    ? tabParam
    : resolveTabFromSection(sectionParam);

  const handleTabChange = (nextTab: string) => {
    if (!isSettingsTab(nextTab)) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t("settings.page.title")}</h1>
          <p className="text-muted-foreground">{t("settings.page.description")}</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="general">{t("settings.page.tabs.general")}</TabsTrigger>
            <TabsTrigger value="config">{t("settings.page.tabs.config")}</TabsTrigger>
            <TabsTrigger value="api">{t("settings.page.tabs.api")}</TabsTrigger>
            <TabsTrigger value="tokens">{t("settings.page.tabs.tokens")}</TabsTrigger>
            <TabsTrigger value="gateway">{t("settings.page.tabs.gateway")}</TabsTrigger>
            <TabsTrigger value="security">{t("settings.page.tabs.security")}</TabsTrigger>
            <TabsTrigger value="subscription">{t("settings.page.tabs.subscription")}</TabsTrigger>
            <TabsTrigger value="about">{t("settings.page.tabs.about")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralTab />
          </TabsContent>
          <TabsContent value="config">
            <ConfigTab activeSection={sectionParam} />
          </TabsContent>
          <TabsContent value="api">
            <ApiTab />
          </TabsContent>
          <TabsContent value="tokens">
            <TokensTab />
          </TabsContent>
          <TabsContent value="gateway">
            <GatewayTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
          <TabsContent value="subscription">
            <Subscription />
          </TabsContent>
          <TabsContent value="about">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
